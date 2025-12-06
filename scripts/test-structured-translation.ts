/**
 * Test script for structured translation output
 * 
 * Takes a structured transcription JSON (from test-structured-transcription.ts)
 * and translates it to the target language while preserving structure.
 * 
 * Usage:
 *   npx tsx scripts/test-structured-translation.ts <json-file> [target-lang]
 * 
 * Example:
 *   npx tsx scripts/test-structured-translation.ts ./transcription.json
 *   npx tsx scripts/test-structured-translation.ts ./transcription.json German
 * 
 * Or pipe from transcription test:
 *   echo '{"cues":[...]}' | npx tsx scripts/test-structured-translation.ts - English
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as fs from "fs";

// ============================================================================
// Schema Definition (Translation extends Transcription)
// ============================================================================

const TranslationCueSchema = {
    type: SchemaType.OBJECT,
    properties: {
        start_seconds: {
            type: SchemaType.NUMBER,
            description: "Start time in seconds (unchanged from source)",
        },
        end_seconds: {
            type: SchemaType.NUMBER,
            description: "End time in seconds (unchanged from source)",
        },
        text: {
            type: SchemaType.STRING,
            description: "Original Japanese text (unchanged)",
        },
        speaker: {
            type: SchemaType.STRING,
            description: "Speaker name (unchanged from source)",
        },
        translated_text: {
            type: SchemaType.STRING,
            description: "Translated text in target language",
        },
        translation_notes: {
            type: SchemaType.STRING,
            description: "Optional: wordplay explanations, cultural notes for viewers",
            nullable: true,
        },
        notes: {
            type: SchemaType.STRING,
            description: "Visual context notes (unchanged from source)",
            nullable: true,
        },
        sound_effects: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Sound effects (unchanged from source)",
            nullable: true,
        },
    },
    required: ["start_seconds", "end_seconds", "text", "speaker", "translated_text"],
};

const StructuredTranslationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        cues: {
            type: SchemaType.ARRAY,
            items: TranslationCueSchema,
        },
        metadata: {
            type: SchemaType.OBJECT,
            properties: {
                source_language: {
                    type: SchemaType.STRING,
                },
                target_language: {
                    type: SchemaType.STRING,
                },
            },
            required: ["source_language", "target_language"],
        },
    },
    required: ["cues", "metadata"],
};

// ============================================================================
// Prompt
// ============================================================================

function buildTranslationPrompt(targetLang: string): string {
    return `
Translate this Japanese comedy/variety show transcription to ${targetLang}.

You will receive a JSON object with:
- cues: array of transcription cues (Japanese dialogue with speaker info)
- metadata: source language info

Return a JSON object with translated cues. For each cue:
- Keep all fields UNCHANGED: start_seconds, end_seconds, text, speaker, notes, sound_effects
- ADD translated_text: natural ${targetLang} translation of the "text" field
- ADD translation_notes: (optional) explain wordplay, cultural references, or jokes that don't translate directly

Translation guidelines:
- Use natural, conversational ${targetLang} (not literal word-for-word)
- Preserve the speaker's tone and personality
- For comedy: prioritize the joke landing over literal accuracy
- Japanese wordplay: translate the humor, add explanation in translation_notes if needed
- Keep timing-appropriate length (subtitles should be readable)
- Sound effects like 笑い声 (laughter), 拍手 (applause) can be noted but don't need translation

The "speaker" field contains the performer's name - use this to maintain consistent voice/style per speaker.
`.trim();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error("Usage: npx tsx scripts/test-structured-translation.ts <json-file> [target-lang]");
        console.error("");
        console.error("  json-file: Path to transcription JSON, or '-' for stdin");
        console.error("  target-lang: Target language (default: English)");
        console.error("");
        console.error("Set GEMINI_API_KEY environment variable");
        process.exit(1);
    }

    const jsonPath = args[0];
    const targetLang = args[1] || "English";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY environment variable not set");
        process.exit(1);
    }

    // Read input JSON
    let inputJson: string;
    if (jsonPath === "-") {
        // Read from stdin
        inputJson = fs.readFileSync(0, "utf-8");
    } else {
        if (!fs.existsSync(jsonPath)) {
            console.error(`Error: File not found: ${jsonPath}`);
            process.exit(1);
        }
        inputJson = fs.readFileSync(jsonPath, "utf-8");
    }

    let transcription;
    try {
        transcription = JSON.parse(inputJson);
    } catch (e) {
        console.error("Error: Invalid JSON input");
        process.exit(1);
    }

    const cueCount = transcription.cues?.length || 0;
    console.log(`\n📝 Input: ${cueCount} cues`);
    console.log(`🎯 Target language: ${targetLang}`);
    console.log(`🔑 API Key: ${apiKey.slice(0, 8)}...`);
    console.log("");

    try {
        console.log("🤖 Generating translation...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";
        console.log(`🤖 Using model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: StructuredTranslationSchema,
            },
        });

        const result = await model.generateContent([
            { text: buildTranslationPrompt(targetLang) },
            { text: `\nTranscription to translate:\n${JSON.stringify(transcription, null, 2)}` },
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
        console.log("STRUCTURED TRANSLATION RESULT");
        console.log("═".repeat(60));
        console.log("");
        console.log(JSON.stringify(parsed, null, 2));
        console.log("");

        // Summary
        console.log("─".repeat(60));
        console.log("SUMMARY");
        console.log("─".repeat(60));
        console.log(`Cues: ${parsed.cues?.length || 0}`);
        console.log(`Source: ${parsed.metadata?.source_language || "unknown"}`);
        console.log(`Target: ${parsed.metadata?.target_language || "unknown"}`);

        const withNotes = parsed.cues?.filter((c: any) => c.translation_notes).length || 0;
        console.log(`Cues with translation notes: ${withNotes}`);

        // Show a few examples
        console.log("");
        console.log("─".repeat(60));
        console.log("SAMPLE TRANSLATIONS (first 5)");
        console.log("─".repeat(60));

        const samples = parsed.cues?.slice(0, 5) || [];
        for (const cue of samples) {
            console.log(`\n[${cue.start_seconds}s] ${cue.speaker}:`);
            console.log(`  JA: ${cue.text}`);
            console.log(`  ${targetLang.toUpperCase().slice(0, 2)}: ${cue.translated_text}`);
            if (cue.translation_notes) {
                console.log(`  📝 Note: ${cue.translation_notes}`);
            }
        }

    } catch (error: any) {
        console.error("");
        console.error("❌ Error:", error.message || error);
        if (error.response) {
            console.error("Response:", await error.response.text?.());
        }
        process.exit(1);
    }
}

main();
