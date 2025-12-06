/**
 * Time-based alignment: Use Whisper timing with Gemini content
 * 
 * Ignores text completely — matches by time overlap only.
 * 
 * Usage:
 *   npx tsx scripts/align-by-time.ts <whisper.json> <gemini.json> [--output <file>]
 */

import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

interface WhisperToken {
    start_ms: number;
    end_ms: number;
    text: string;
}

interface GeminiCue {
    start_seconds: number;
    end_seconds: number;
    text: string;
    speaker: string;
    notes?: string | null;
    sound_effects?: string[] | null;
}

interface AlignedCue extends GeminiCue {
    original_start: number;
    original_end: number;
    timing_adjusted: boolean;
}

// ============================================================================
// Whisper JSON Parsing
// ============================================================================

function parseWhisperJson(content: string): WhisperToken[] {
    const data = JSON.parse(content);
    const tokens: WhisperToken[] = [];

    for (const item of data.transcription || []) {
        const text = item.text?.trim() || "";

        // Skip empty, music notes, or punctuation-only
        if (!text || text === "♪" || text === "~" || /^[、。！？\s]+$/.test(text)) {
            continue;
        }

        // Skip broken UTF-8 fragments
        if (text.includes("�")) {
            continue;
        }

        tokens.push({
            start_ms: item.offsets?.from || 0,
            end_ms: item.offsets?.to || 0,
            text,
        });
    }

    return tokens;
}

// ============================================================================
// Merge adjacent tokens into speech regions
// ============================================================================

interface SpeechRegion {
    start_ms: number;
    end_ms: number;
}

function findSpeechRegions(tokens: WhisperToken[], gapThresholdMs: number = 500): SpeechRegion[] {
    if (tokens.length === 0) return [];

    const regions: SpeechRegion[] = [];
    let currentRegion: SpeechRegion = {
        start_ms: tokens[0].start_ms,
        end_ms: tokens[0].end_ms,
    };

    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const gap = token.start_ms - currentRegion.end_ms;

        if (gap > gapThresholdMs) {
            // New region
            regions.push(currentRegion);
            currentRegion = { start_ms: token.start_ms, end_ms: token.end_ms };
        } else {
            // Extend current region
            currentRegion.end_ms = Math.max(currentRegion.end_ms, token.end_ms);
        }
    }

    regions.push(currentRegion);
    return regions;
}

// ============================================================================
// Time-based alignment
// ============================================================================

function alignByTime(
    whisperTokens: WhisperToken[],
    geminiCues: GeminiCue[]
): AlignedCue[] {
    const aligned: AlignedCue[] = [];

    // Build speech regions from Whisper tokens
    const regions = findSpeechRegions(whisperTokens, 300);

    console.error(`📍 Found ${regions.length} speech regions from ${whisperTokens.length} tokens`);

    for (const gemini of geminiCues) {
        const geminiStartMs = gemini.start_seconds * 1000;
        const geminiEndMs = gemini.end_seconds * 1000;

        // Find Whisper tokens that overlap with this Gemini cue
        const overlappingTokens = whisperTokens.filter(t => {
            // Check for any overlap
            return t.end_ms > geminiStartMs && t.start_ms < geminiEndMs;
        });

        if (overlappingTokens.length > 0) {
            // Use Whisper timing from overlapping tokens
            const whisperStart = Math.min(...overlappingTokens.map(t => t.start_ms));
            const whisperEnd = Math.max(...overlappingTokens.map(t => t.end_ms));

            aligned.push({
                start_seconds: whisperStart / 1000,
                end_seconds: whisperEnd / 1000,
                text: gemini.text,
                speaker: gemini.speaker,
                notes: gemini.notes,
                sound_effects: gemini.sound_effects,
                original_start: gemini.start_seconds,
                original_end: gemini.end_seconds,
                timing_adjusted: true,
            });
        } else {
            // No overlap — find nearest speech region
            let nearestRegion: SpeechRegion | null = null;
            let minDistance = Infinity;

            for (const region of regions) {
                const distance = Math.min(
                    Math.abs(region.start_ms - geminiStartMs),
                    Math.abs(region.end_ms - geminiEndMs)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestRegion = region;
                }
            }

            if (nearestRegion && minDistance < 10000) { // Within 10 seconds
                aligned.push({
                    start_seconds: nearestRegion.start_ms / 1000,
                    end_seconds: nearestRegion.end_ms / 1000,
                    text: gemini.text,
                    speaker: gemini.speaker,
                    notes: gemini.notes,
                    sound_effects: gemini.sound_effects,
                    original_start: gemini.start_seconds,
                    original_end: gemini.end_seconds,
                    timing_adjusted: true,
                });
            } else {
                // Keep original Gemini timing
                aligned.push({
                    ...gemini,
                    original_start: gemini.start_seconds,
                    original_end: gemini.end_seconds,
                    timing_adjusted: false,
                });
            }
        }
    }

    // Sort by start time
    aligned.sort((a, b) => a.start_seconds - b.start_seconds);

    return aligned;
}

// ============================================================================
// Main
// ============================================================================

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2 || args[0] === "--help") {
        console.log(`
Time-based alignment: Use Whisper timing with Gemini content.

Usage:
  npx tsx scripts/align-by-time.ts <whisper.json> <gemini.json> [--output <file>]

Example:
  npx tsx scripts/align-by-time.ts whisper-words.json gemini.json > aligned.json
    `.trim());
        process.exit(0);
    }

    const whisperPath = args[0];
    const geminiPath = args[1];

    let outputPath: string | null = null;
    const outputIdx = args.indexOf("--output");
    if (outputIdx !== -1 && args[outputIdx + 1]) {
        outputPath = args[outputIdx + 1];
    }

    // Read inputs
    if (!fs.existsSync(whisperPath)) {
        console.error(`Error: Whisper JSON not found: ${whisperPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(geminiPath)) {
        console.error(`Error: Gemini JSON not found: ${geminiPath}`);
        process.exit(1);
    }

    const whisperContent = fs.readFileSync(whisperPath, "utf-8");
    const geminiContent = fs.readFileSync(geminiPath, "utf-8");

    const whisperTokens = parseWhisperJson(whisperContent);
    let geminiData;
    try {
        geminiData = JSON.parse(geminiContent);
    } catch (e) {
        console.error("Error: Invalid Gemini JSON");
        process.exit(1);
    }

    console.error(`🎤 Whisper tokens: ${whisperTokens.length}`);
    console.error(`🤖 Gemini cues: ${geminiData.cues?.length || 0}`);
    console.error("");

    // Align
    const aligned = alignByTime(whisperTokens, geminiData.cues || []);

    // Stats
    const adjusted = aligned.filter(c => c.timing_adjusted).length;
    const kept = aligned.filter(c => !c.timing_adjusted).length;

    console.error(`✅ Aligned cues: ${aligned.length}`);
    console.error(`   Timing adjusted: ${adjusted}`);
    console.error(`   Original timing kept: ${kept}`);
    console.error("");

    // Output
    const output = {
        cues: aligned,
        metadata: {
            ...geminiData.metadata,
            alignment: {
                whisper_tokens: whisperTokens.length,
                gemini_cues: geminiData.cues?.length || 0,
                timing_adjusted: adjusted,
                timing_kept: kept,
            },
        },
    };

    const json = JSON.stringify(output, null, 2);

    if (outputPath) {
        fs.writeFileSync(outputPath, json, "utf-8");
        console.error(`💾 Wrote to ${outputPath}`);
    } else {
        console.log(json);
    }
}

main();
