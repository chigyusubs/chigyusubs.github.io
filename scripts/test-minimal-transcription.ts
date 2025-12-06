/**
 * Test script with MINIMAL schema and EXPLICIT coverage requirement
 * 
 * Same approach but:
 * - Removed optional fields (notes, sound_effects)
 * - Explicit "cover entire video" instruction
 * - Gap detection
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Minimal Schema - only essential fields
// ============================================================================

const MinimalCueSchema = {
    type: SchemaType.OBJECT,
    properties: {
        s: { type: SchemaType.NUMBER, description: "Start time in seconds" },
        e: { type: SchemaType.NUMBER, description: "End time in seconds" },
        t: { type: SchemaType.STRING, description: "Transcribed text" },
        p: { type: SchemaType.STRING, description: "Speaker name" },
    },
    required: ["s", "e", "t", "p"],
};

const MinimalTranscriptionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        cues: {
            type: SchemaType.ARRAY,
            items: MinimalCueSchema,
        },
        dur: { type: SchemaType.NUMBER, description: "Video duration in seconds" },
    },
    required: ["cues", "dur"],
};

// ============================================================================
// Prompt with EXPLICIT coverage requirement
// ============================================================================

const MINIMAL_PROMPT = `
Transcribe ALL spoken dialogue in this Japanese variety show video.

CRITICAL - COMPLETE COVERAGE:
- You MUST transcribe from 0:00 to the end with NO GAPS
- Every 30 seconds must have at least one cue
- If there's silence, note it: { s: 60, e: 65, t: "（沈黙）", p: "SILENCE" }
- DO NOT skip any section of the video

SPEAKER IDENTIFICATION:
- Read タイトルカード (name cards) on screen
- Use the name shown, or "Unknown" if not visible

CUE LENGTH:
- Max 20 characters per cue
- Split at natural pauses (、。 or breaths)
- Each cue: 2-6 seconds

Return JSON with short field names:
- s: start seconds
- e: end seconds  
- t: text (spoken words only)
- p: person (speaker name)
- dur: total video duration
`.trim();

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error("Usage: npx tsx scripts/test-minimal-transcription.ts <video-file>");
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

        console.log("🤖 Generating minimal transcription...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";
        console.log(`🤖 Model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: MinimalTranscriptionSchema,
            },
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: MINIMAL_PROMPT },
        ]);

        const text = result.response.text();
        const usage = result.response.usageMetadata;

        console.log("✅ Response received");
        if (usage) {
            console.log(`📊 Tokens: ${usage.promptTokenCount} in / ${usage.candidatesTokenCount} out / ${usage.totalTokenCount} total`);
        }
        console.log("");

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("❌ Failed to parse JSON:");
            console.error(text);
            process.exit(1);
        }

        const cues = parsed.cues || [];

        console.log("═".repeat(60));
        console.log("MINIMAL TRANSCRIPTION RESULT");
        console.log("═".repeat(60));
        console.log(`Duration: ${parsed.dur}s`);
        console.log(`Cues: ${cues.length}`);
        console.log("");

        // Gap detection
        console.log("─".repeat(60));
        console.log("COVERAGE CHECK");
        console.log("─".repeat(60));

        let lastEnd = 0;
        let gapCount = 0;

        for (const cue of cues) {
            if (cue.s - lastEnd > 5) {
                gapCount++;
                console.log(`⚠️  Gap: ${lastEnd.toFixed(1)}s → ${cue.s.toFixed(1)}s (${(cue.s - lastEnd).toFixed(1)}s missing)`);
            }
            lastEnd = cue.e;
        }

        // Check end coverage
        if (parsed.dur && parsed.dur - lastEnd > 5) {
            gapCount++;
            console.log(`⚠️  Gap at end: ${lastEnd.toFixed(1)}s → ${parsed.dur.toFixed(1)}s`);
        }

        if (gapCount === 0) {
            console.log("✅ Full coverage - no significant gaps!");
        } else {
            console.log(`\n❌ Found ${gapCount} gap(s)`);
        }
        console.log("");

        // Speakers
        const speakers = new Set(cues.map((c: any) => c.p));
        console.log(`Speakers: ${[...speakers].join(", ")}`);
        console.log("");

        // Sample cues (expanded format)
        console.log("─".repeat(60));
        console.log("SAMPLE CUES (first 15)");
        console.log("─".repeat(60));

        for (let i = 0; i < Math.min(15, cues.length); i++) {
            const c = cues[i];
            console.log(`[${c.s.toFixed(1)}-${c.e.toFixed(1)}] ${c.p}: ${c.t}`);
        }

        // Full JSON
        console.log("");
        console.log("─".repeat(60));
        console.log("FULL JSON");
        console.log("─".repeat(60));
        console.log(JSON.stringify(parsed, null, 2));

        // Cleanup
        console.log("");
        await fileManager.deleteFile(file.name);
        console.log("✅ Done");

    } catch (error: any) {
        console.error("❌ Error:", error.message || error);
        process.exit(1);
    }
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "video/mp4";
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
