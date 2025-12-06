/**
 * Test script for structured transcription output
 * 
 * Usage:
 *   npx tsx scripts/test-structured-transcription.ts <video-file> [api-key]
 * 
 * Example:
 *   npx tsx scripts/test-structured-transcription.ts ./test-clip.mp4
 *   GEMINI_API_KEY=xxx npx tsx scripts/test-structured-transcription.ts ./test-clip.mp4
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Schema Definition (from STRUCTURED_OUTPUT.md)
// ============================================================================

const TranscriptionCueSchema = {
    type: SchemaType.OBJECT,
    properties: {
        start_seconds: {
            type: SchemaType.NUMBER,
            description: "Start time in seconds (0.1s precision)",
        },
        end_seconds: {
            type: SchemaType.NUMBER,
            description: "End time in seconds (0.1s precision)",
        },
        text: {
            type: SchemaType.STRING,
            description: "Japanese transcription text",
        },
        speaker: {
            type: SchemaType.STRING,
            description: "Speaker name from on-screen card, or 'Unknown'",
        },
        notes: {
            type: SchemaType.STRING,
            description: "Optional: visual context, wordplay, reactions",
            nullable: true,
        },
        sound_effects: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Optional: sound effects like 笑い声, 拍手",
            nullable: true,
        },
    },
    required: ["start_seconds", "end_seconds", "text", "speaker"],
};

const StructuredTranscriptionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        cues: {
            type: SchemaType.ARRAY,
            items: TranscriptionCueSchema,
        },
        metadata: {
            type: SchemaType.OBJECT,
            properties: {
                duration: {
                    type: SchemaType.NUMBER,
                    description: "Video duration in seconds",
                    nullable: true,
                },
                language: {
                    type: SchemaType.STRING,
                    description: "Source language code (e.g., 'ja')",
                },
            },
            required: ["language"],
        },
    },
    required: ["cues", "metadata"],
};

// ============================================================================
// Prompt
// ============================================================================

const TRANSCRIPTION_PROMPT = `
Transcribe this Japanese comedy/variety show video segment.

IMPORTANT - Speaker identification:
- Look for タイトルカード (title cards) and テロップ (on-screen text) that show speaker names
- Japanese variety shows display the speaker's name on screen when they talk
- Use the name shown on screen as the "speaker" field
- Common formats: 名前 alone, 名前(グループ名), or テロップ with 名前
- If no name card is visible, use "Unknown"

Return a JSON object with:
- cues: array of transcription cues (SPOKEN dialogue only, not on-screen text)
- metadata: { language: "ja", duration: video duration in seconds }

For each cue:
- start_seconds, end_seconds: timing of the SPOKEN words (0.1s precision)
- text: what is SAID (spoken dialogue), not what appears on screen
- speaker: the name shown on the タイトルカード/テロップ, or "Unknown"
- notes: (optional) visual context like reactions, gestures, on-screen captions that add meaning
- sound_effects: (optional) array like ["笑い声", "拍手", "効果音"]

DO NOT include:
- On-screen text/captions as cues (only transcribe spoken words)
- Title cards as cue text (use them to identify speakers)
`.trim();

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error("Usage: npx tsx scripts/test-structured-transcription.ts <video-file> [api-key]");
        console.error("");
        console.error("Or set GEMINI_API_KEY environment variable");
        process.exit(1);
    }

    const videoPath = args[0];
    const apiKey = args[1] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Error: No API key provided");
        console.error("Either pass as second argument or set GEMINI_API_KEY env var");
        process.exit(1);
    }

    if (!fs.existsSync(videoPath)) {
        console.error(`Error: Video file not found: ${videoPath}`);
        process.exit(1);
    }

    const absolutePath = path.resolve(videoPath);
    const mimeType = getMimeType(videoPath);

    console.log(`\n📹 Video: ${absolutePath}`);
    console.log(`📦 MIME type: ${mimeType}`);
    console.log(`🔑 API Key: ${apiKey.slice(0, 8)}...`);
    console.log("");

    try {
        // Upload file
        console.log("⬆️  Uploading video to Gemini...");
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(absolutePath, {
            mimeType,
            displayName: path.basename(videoPath),
        });

        console.log(`✅ Uploaded: ${uploadResult.file.uri}`);
        console.log(`   State: ${uploadResult.file.state}`);

        // Wait for processing if needed
        let file = uploadResult.file;
        while (file.state === "PROCESSING") {
            console.log("   Waiting for processing...");
            await sleep(2000);
            file = await fileManager.getFile(file.name);
        }

        if (file.state === "FAILED") {
            throw new Error(`File processing failed: ${file.name}`);
        }

        console.log(`✅ Ready: ${file.state}`);
        console.log("");

        // Generate structured transcription
        console.log("🤖 Generating structured transcription...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";
        console.log(`🤖 Using model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: StructuredTranscriptionSchema,
            },
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: TRANSCRIPTION_PROMPT },
        ]);

        const response = result.response;
        const text = response.text();

        console.log("✅ Response received");
        console.log("");

        // Parse and validate
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("❌ Failed to parse JSON:");
            console.error(text);
            process.exit(1);
        }

        // Output results
        console.log("═".repeat(60));
        console.log("STRUCTURED TRANSCRIPTION RESULT");
        console.log("═".repeat(60));
        console.log("");
        console.log(JSON.stringify(parsed, null, 2));
        console.log("");

        // Summary
        console.log("─".repeat(60));
        console.log("SUMMARY");
        console.log("─".repeat(60));
        console.log(`Cues: ${parsed.cues?.length || 0}`);
        console.log(`Language: ${parsed.metadata?.language || "unknown"}`);
        console.log(`Duration: ${parsed.metadata?.duration || "unknown"}s`);

        const speakers = new Set(parsed.cues?.map((c: any) => c.speaker) || []);
        console.log(`Speakers: ${[...speakers].join(", ") || "none"}`);

        const withNotes = parsed.cues?.filter((c: any) => c.notes).length || 0;
        console.log(`Cues with notes: ${withNotes}`);

        const withSfx = parsed.cues?.filter((c: any) => c.sound_effects?.length).length || 0;
        console.log(`Cues with sound effects: ${withSfx}`);

        // Cleanup
        console.log("");
        console.log("🗑️  Deleting uploaded file...");
        await fileManager.deleteFile(file.name);
        console.log("✅ Cleanup complete");

    } catch (error: any) {
        console.error("");
        console.error("❌ Error:", error.message || error);
        if (error.response) {
            console.error("Response:", await error.response.text?.());
        }
        process.exit(1);
    }
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
    };
    return mimeTypes[ext] || "application/octet-stream";
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
