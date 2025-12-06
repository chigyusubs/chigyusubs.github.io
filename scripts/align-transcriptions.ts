/**
 * Align Gemini transcription with Whisper timing
 * 
 * Takes:
 * - Whisper VTT (accurate timing, basic transcription)
 * - Gemini JSON (rich content, drifted timing)
 * 
 * Produces:
 * - Combined JSON (Whisper timing + Gemini content)
 * 
 * Usage:
 *   npx tsx scripts/align-transcriptions.ts <whisper.vtt> <gemini.json> [--output <file>]
 * 
 * Algorithm:
 * 1. Parse both inputs
 * 2. For each Gemini cue, find the best matching Whisper cue by text similarity
 * 3. Use Whisper timing, Gemini content (speaker, notes, etc.)
 * 4. Handle unmatched cues (Gemini-only content like narrator)
 */

import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

interface WhisperCue {
    start_seconds: number;
    end_seconds: number;
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
    timing_source: "whisper" | "gemini";
    confidence: number; // 0-1, how well the texts matched
}

// ============================================================================
// VTT Parsing
// ============================================================================

function parseVTT(content: string): WhisperCue[] {
    const cues: WhisperCue[] = [];
    const lines = content.split("\n");

    let i = 0;
    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes("-->")) {
        i++;
    }

    while (i < lines.length) {
        const line = lines[i].trim();

        // Look for timestamp line
        if (line.includes("-->")) {
            const match = line.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
            if (match) {
                const start = parseTimestamp(match[1]);
                const end = parseTimestamp(match[2]);

                // Collect text lines until empty line or next cue
                const textLines: string[] = [];
                i++;
                while (i < lines.length && lines[i].trim() && !lines[i].includes("-->")) {
                    // Skip cue numbers
                    if (!/^\d+$/.test(lines[i].trim())) {
                        textLines.push(lines[i].trim());
                    }
                    i++;
                }

                if (textLines.length > 0) {
                    cues.push({
                        start_seconds: start,
                        end_seconds: end,
                        text: textLines.join("\n"),
                    });
                }
            }
        } else {
            i++;
        }
    }

    return cues;
}

function parseTimestamp(ts: string): number {
    const parts = ts.replace(",", ".").split(":");
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseFloat(parts[2]);
    return hours * 3600 + mins * 60 + secs;
}

// ============================================================================
// Text Similarity (Fast character overlap - O(n) instead of O(n*m))
// ============================================================================

function textSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Normalize: remove whitespace
    const normA = a.replace(/\s+/g, "");
    const normB = b.replace(/\s+/g, "");

    if (normA.length === 0 || normB.length === 0) return 0;

    // Use character frequency overlap (Jaccard-like, but faster)
    const charsA = new Set(normA);
    const charsB = new Set(normB);

    let intersection = 0;
    for (const char of charsA) {
        if (charsB.has(char)) intersection++;
    }

    const union = charsA.size + charsB.size - intersection;
    const charOverlap = intersection / union;

    // Also check prefix match (first N chars) for ordering
    const prefixLen = Math.min(10, normA.length, normB.length);
    const prefixA = normA.slice(0, prefixLen);
    const prefixB = normB.slice(0, prefixLen);
    let prefixMatch = 0;
    for (let i = 0; i < prefixLen; i++) {
        if (prefixA[i] === prefixB[i]) prefixMatch++;
    }
    const prefixScore = prefixMatch / prefixLen;

    // Combine: weight char overlap heavily, prefix as tiebreaker
    return charOverlap * 0.7 + prefixScore * 0.3;
}

// ============================================================================
// Alignment Algorithm
// ============================================================================

function alignTranscriptions(
    whisperCues: WhisperCue[],
    geminiCues: GeminiCue[],
    options: { similarityThreshold: number; maxTimeGap: number }
): AlignedCue[] {
    const aligned: AlignedCue[] = [];
    const usedWhisper = new Set<number>();

    // For each Gemini cue, find best matching Whisper cue
    for (const gemini of geminiCues) {
        let bestMatch: { whisperIdx: number; similarity: number } | null = null;

        for (let i = 0; i < whisperCues.length; i++) {
            if (usedWhisper.has(i)) continue;

            const whisper = whisperCues[i];

            // Time proximity check: don't match cues more than maxTimeGap seconds apart
            const timeDiff = Math.abs(gemini.start_seconds - whisper.start_seconds);
            if (timeDiff > options.maxTimeGap) continue;

            const similarity = textSimilarity(gemini.text, whisper.text);

            if (similarity >= options.similarityThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { whisperIdx: i, similarity };
                }
            }
        }

        if (bestMatch) {
            // Use Whisper timing, Gemini content
            const whisper = whisperCues[bestMatch.whisperIdx];
            usedWhisper.add(bestMatch.whisperIdx);

            aligned.push({
                start_seconds: whisper.start_seconds,
                end_seconds: whisper.end_seconds,
                text: gemini.text,
                speaker: gemini.speaker,
                notes: gemini.notes,
                sound_effects: gemini.sound_effects,
                timing_source: "whisper",
                confidence: bestMatch.similarity,
            });
        } else {
            // No match found — keep Gemini timing (e.g., narrator that Whisper missed)
            aligned.push({
                ...gemini,
                timing_source: "gemini",
                confidence: 0,
            });
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

    if (args.length < 2 || args[0] === "--help" || args[0] === "-h") {
        console.log(`
Align Gemini transcription with Whisper timing.

Usage:
  npx tsx scripts/align-transcriptions.ts <whisper.vtt> <gemini.json> [options]

Options:
  --output <file>        Write aligned JSON to file instead of stdout
  --threshold <0-1>      Minimum text similarity to match (default: 0.5)
  --max-gap <seconds>    Maximum time difference for matching (default: 60)

Example:
  npx tsx scripts/align-transcriptions.ts whisper.vtt gemini.json > aligned.json
    `.trim());
        process.exit(0);
    }

    const whisperPath = args[0];
    const geminiPath = args[1];

    let outputPath: string | null = null;
    let threshold = 0.5;
    let maxGap = 60;

    for (let i = 2; i < args.length; i++) {
        if (args[i] === "--output" && args[i + 1]) {
            outputPath = args[++i];
        } else if (args[i] === "--threshold" && args[i + 1]) {
            threshold = parseFloat(args[++i]);
        } else if (args[i] === "--max-gap" && args[i + 1]) {
            maxGap = parseFloat(args[++i]);
        }
    }

    // Read inputs
    if (!fs.existsSync(whisperPath)) {
        console.error(`Error: Whisper VTT not found: ${whisperPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(geminiPath)) {
        console.error(`Error: Gemini JSON not found: ${geminiPath}`);
        process.exit(1);
    }

    const whisperContent = fs.readFileSync(whisperPath, "utf-8");
    const geminiContent = fs.readFileSync(geminiPath, "utf-8");

    const whisperCues = parseVTT(whisperContent);
    let geminiData;
    try {
        geminiData = JSON.parse(geminiContent);
    } catch (e) {
        console.error("Error: Invalid Gemini JSON");
        process.exit(1);
    }

    console.error(`📝 Whisper cues: ${whisperCues.length}`);
    console.error(`🤖 Gemini cues: ${geminiData.cues?.length || 0}`);
    console.error(`🎯 Similarity threshold: ${threshold}`);
    console.error(`⏱️  Max time gap: ${maxGap}s`);
    console.error("");

    // Align
    const aligned = alignTranscriptions(whisperCues, geminiData.cues || [], {
        similarityThreshold: threshold,
        maxTimeGap: maxGap,
    });

    // Stats
    const whisperTimed = aligned.filter(c => c.timing_source === "whisper").length;
    const geminiTimed = aligned.filter(c => c.timing_source === "gemini").length;
    const avgConfidence = aligned.reduce((sum, c) => sum + c.confidence, 0) / aligned.length;

    console.error(`✅ Aligned cues: ${aligned.length}`);
    console.error(`   Whisper-timed: ${whisperTimed}`);
    console.error(`   Gemini-timed (unmatched): ${geminiTimed}`);
    console.error(`   Avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.error("");

    // Output
    const output = {
        cues: aligned,
        metadata: {
            ...geminiData.metadata,
            alignment: {
                whisper_cues: whisperCues.length,
                gemini_cues: geminiData.cues?.length || 0,
                matched: whisperTimed,
                unmatched: geminiTimed,
                avg_confidence: avgConfidence,
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
