/**
 * Test script for COMPACT structured transcription
 * 
 * Uses array tuples instead of objects to reduce token overhead.
 * Format: [start, end, speaker, text]
 * 
 * Usage:
 *   npx tsx scripts/test-compact-transcription.ts <video-file>
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Compact Schema - Array tuples instead of objects
// ============================================================================

const CompactTranscriptionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        // Each cue is: [start_seconds, end_seconds, speaker, text]
        cues: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.ARRAY,
                items: [
                    { type: SchemaType.NUMBER }, // start
                    { type: SchemaType.NUMBER }, // end
                    { type: SchemaType.STRING }, // speaker
                    { type: SchemaType.STRING }, // text
                ],
            },
        },
        duration: {
            type: SchemaType.NUMBER,
        },
    },
    required: ["cues", "duration"],
};

// ============================================================================
// Prompt with explicit coverage requirement
// ============================================================================

const COMPACT_PROMPT = `
Transcribe this Japanese variety show video.

CRITICAL REQUIREMENTS:
1. You MUST transcribe ALL spoken dialogue from 0:00 to the end
2. Do NOT skip any sections - cover the ENTIRE video continuously
3. Every 30 seconds of video should have at least one cue (even noting silence)

OUTPUT FORMAT:
Return cues as compact arrays: [start_seconds, end_seconds, speaker, text]
- Keep cues short (2-6 seconds, max 20 characters)
- Split long sentences at natural pauses

SPEAKER IDENTIFICATION:
- Read タイトルカード (name cards) on screen to identify speakers
- Use the exact name shown, or "Unknown" if not visible

Example output:
{
  "cues": [
    [3.5, 6.0, "浜田 雅功", "水曜日のダウンタウン"],
    [7.0, 9.0, "高橋 茂雄", "プレゼンターです"]
  ],
  "duration": 120
}
`.trim();

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error("Usage: npx tsx scripts/test-compact-transcription.ts <video-file>");
        process.exit(1);
    }

    const videoPath = args[0];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY not set");
        process.exit(1);
    }

    if (!fs.existsSync(videoPath)) {
        console.error(`Error: File not found: ${videoPath}`);
        process.exit(1);
    }

    const absolutePath = path.resolve(videoPath);
    const mimeType = getMimeType(videoPath);

    console.log(`\n📹 Video: ${absolutePath}`);
    console.log(`🔑 API Key: ${apiKey.slice(0, 8)}...`);
    console.log("");

    try {
        // Upload
        console.log("⬆️  Uploading...");
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(absolutePath, {
            mimeType,
            displayName: path.basename(videoPath),
        });

        let file = uploadResult.file;
        while (file.state === "PROCESSING") {
            console.log("   Processing...");
            await sleep(2000);
            file = await fileManager.getFile(file.name);
        }

        console.log(`✅ Ready`);
        console.log("");

        // Generate
        console.log("🤖 Generating compact transcription...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";
        console.log(`🤖 Model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: CompactTranscriptionSchema,
            },
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: COMPACT_PROMPT },
        ]);

        const text = result.response.text();
        console.log("✅ Response received");
        console.log("");

        // Parse
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("❌ Failed to parse JSON:");
            console.error(text);
            process.exit(1);
        }

        // Convert to readable format and check coverage
        console.log("═".repeat(60));
        console.log("COMPACT TRANSCRIPTION RESULT");
        console.log("═".repeat(60));
        console.log("");

        const cues = parsed.cues || [];
        console.log(`Duration: ${parsed.duration}s`);
        console.log(`Cues: ${cues.length}`);
        console.log("");

        // Check for gaps
        console.log("─".repeat(60));
        console.log("COVERAGE CHECK (gaps > 5s)");
        console.log("─".repeat(60));

        let lastEnd = 0;
        let gaps: { from: number; to: number }[] = [];

        for (const cue of cues) {
            const [start, end, speaker, text] = cue;
            if (start - lastEnd > 5) {
                gaps.push({ from: lastEnd, to: start });
                console.log(`⚠️  Gap: ${lastEnd.toFixed(1)}s → ${start.toFixed(1)}s (${(start - lastEnd).toFixed(1)}s)`);
            }
            lastEnd = end;
        }

        if (gaps.length === 0) {
            console.log("✅ No significant gaps detected!");
        }
        console.log("");

        // Show speakers
        const speakers = new Set(cues.map((c: any[]) => c[2]));
        console.log(`Speakers: ${[...speakers].join(", ")}`);
        console.log("");

        // Show first 10 cues
        console.log("─".repeat(60));
        console.log("SAMPLE CUES (first 10)");
        console.log("─".repeat(60));

        for (let i = 0; i < Math.min(10, cues.length); i++) {
            const [start, end, speaker, text] = cues[i];
            console.log(`[${start.toFixed(1)}-${end.toFixed(1)}s] ${speaker}: ${text}`);
        }

        // Raw JSON output
        console.log("");
        console.log("─".repeat(60));
        console.log("RAW JSON");
        console.log("─".repeat(60));
        console.log(JSON.stringify(parsed, null, 2));

        // Cleanup
        console.log("");
        console.log("🗑️  Deleting uploaded file...");
        await fileManager.deleteFile(file.name);
        console.log("✅ Done");

    } catch (error: any) {
        console.error("❌ Error:", error.message || error);
        process.exit(1);
    }
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
    };
    return mimeTypes[ext] || "video/mp4";
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
