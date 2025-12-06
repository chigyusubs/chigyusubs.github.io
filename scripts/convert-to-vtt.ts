/**
 * Convert structured translation JSON to VTT subtitle format
 * 
 * Usage:
 *   npx tsx scripts/convert-to-vtt.ts <json-file> [options]
 * 
 * Options:
 *   --include-speaker    Prefix each subtitle with speaker name
 *   --include-notes      Add translation notes as separate cues
 *   --output <file>      Write to file instead of stdout
 * 
 * Example:
 *   npx tsx scripts/convert-to-vtt.ts translation.json --include-speaker > output.vtt
 *   npx tsx scripts/convert-to-vtt.ts translation.json --output subtitles.vtt
 */

import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

interface TranslationCue {
    start_seconds: number;
    end_seconds: number;
    text: string;
    speaker: string;
    translated_text: string;
    translation_notes?: string | null;
    notes?: string | null;
    sound_effects?: string[] | null;
}

interface StructuredTranslation {
    cues: TranslationCue[];
    metadata: {
        source_language: string;
        target_language: string;
    };
}

// ============================================================================
// VTT Formatting
// ============================================================================

function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function formatCue(
    cue: TranslationCue,
    index: number,
    options: { includeSpeaker: boolean }
): string {
    const start = formatTimestamp(cue.start_seconds);
    const end = formatTimestamp(cue.end_seconds);

    let text = cue.translated_text || cue.text;

    // Optionally prefix with speaker name
    if (options.includeSpeaker && cue.speaker && cue.speaker !== "Unknown") {
        text = `${cue.speaker}: ${text}`;
    }

    return `${index}\n${start} --> ${end}\n${text}`;
}

function formatNoteCue(
    cue: TranslationCue,
    index: number
): string | null {
    if (!cue.translation_notes) return null;

    // Show note slightly after the cue it references
    const noteStart = cue.end_seconds;
    const noteEnd = cue.end_seconds + 3; // 3 second display for notes

    const start = formatTimestamp(noteStart);
    const end = formatTimestamp(noteEnd);

    return `${index}\n${start} --> ${end}\n[Note: ${cue.translation_notes}]`;
}

function convertToVTT(
    translation: StructuredTranslation,
    options: { includeSpeaker: boolean; includeNotes: boolean }
): string {
    const lines: string[] = ["WEBVTT", ""];

    let cueIndex = 1;

    for (const cue of translation.cues) {
        // Main translated cue
        lines.push(formatCue(cue, cueIndex++, options));
        lines.push("");

        // Optional translation note as separate cue
        if (options.includeNotes) {
            const noteCue = formatNoteCue(cue, cueIndex);
            if (noteCue) {
                lines.push(noteCue);
                lines.push("");
                cueIndex++;
            }
        }
    }

    return lines.join("\n");
}

// ============================================================================
// Main
// ============================================================================

function main() {
    const args = process.argv.slice(2);

    if (args.length < 1 || args[0] === "--help" || args[0] === "-h") {
        console.log(`
Convert structured translation JSON to VTT subtitle format.

Usage:
  npx tsx scripts/convert-to-vtt.ts <json-file> [options]

Options:
  --include-speaker    Prefix each subtitle with speaker name (e.g., "浜田雅功: Hello")
  --include-notes      Add translation notes as separate subtitle cues
  --output <file>      Write VTT to file instead of stdout
  -h, --help           Show this help

Examples:
  npx tsx scripts/convert-to-vtt.ts translation.json > output.vtt
  npx tsx scripts/convert-to-vtt.ts translation.json --include-speaker --output subs.vtt
    `.trim());
        process.exit(0);
    }

    const jsonPath = args[0];
    const includeSpeaker = args.includes("--include-speaker");
    const includeNotes = args.includes("--include-notes");

    let outputPath: string | null = null;
    const outputIndex = args.indexOf("--output");
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputPath = args[outputIndex + 1];
    }

    // Read input
    if (!fs.existsSync(jsonPath)) {
        console.error(`Error: File not found: ${jsonPath}`);
        process.exit(1);
    }

    let translation: StructuredTranslation;
    try {
        const content = fs.readFileSync(jsonPath, "utf-8");
        translation = JSON.parse(content);
    } catch (e) {
        console.error("Error: Invalid JSON file");
        process.exit(1);
    }

    if (!translation.cues || !Array.isArray(translation.cues)) {
        console.error("Error: JSON must have a 'cues' array");
        process.exit(1);
    }

    // Convert
    const vtt = convertToVTT(translation, { includeSpeaker, includeNotes });

    // Output
    if (outputPath) {
        fs.writeFileSync(outputPath, vtt, "utf-8");
        console.error(`✅ Wrote ${translation.cues.length} cues to ${outputPath}`);
    } else {
        console.log(vtt);
    }
}

main();
