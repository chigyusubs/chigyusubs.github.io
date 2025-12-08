
import type { StructuredTranslationOutput } from "./StructuredOutput";
import { type Cue, serializeVtt } from "../vtt";

/**
 * Reconstructs a valid VTT string from the LLM's structured JSON output
 * and the original source cues (for timing).
 */
export function reconstructVtt(
    output: StructuredTranslationOutput,
    originalCues: Cue[],
): { vtt: string; warnings: string[] } {
    const warnings: string[] = [];
    const newCues: Cue[] = [];

    const usedIds = new Set<number>();

    for (const item of output.translations) {
        if (item.ids.length === 0) {
            warnings.push("Found translation item with no IDs, skipping.");
            continue;
        }

        // Validate IDs exist in source
        const validIds = item.ids.filter(id => {
            const index = id - 1; // 1-based to 0-based
            if (index < 0 || index >= originalCues.length) {
                warnings.push(`Skipping invalid ID ${id} (out of bounds)`);
                return false;
            }
            if (usedIds.has(id)) {
                warnings.push(`ID ${id} used multiple times. Ignoring duplicate usage.`);
                return false;
            }
            return true;
        });

        if (validIds.length === 0) continue;

        // Mark as used
        validIds.forEach(id => usedIds.add(id));

        // Calculate Timing
        // We assume validIds are roughly adjacent, but even if not, we take Min(Start) and Max(End)
        // to ensure the subtitle covers the span of all included cues.
        let minStart = Infinity;
        let maxEnd = -Infinity;

        validIds.forEach(id => {
            const cue = originalCues[id - 1];
            if (cue.start < minStart) minStart = cue.start;
            if (cue.end > maxEnd) maxEnd = cue.end;
        });

        newCues.push({
            start: minStart,
            end: maxEnd,
            text: item.text.trim()
        });
    }

    // Check for missing IDs
    const missingIds: number[] = [];
    for (let i = 1; i <= originalCues.length; i++) {
        if (!usedIds.has(i)) {
            missingIds.push(i);
        }
    }

    if (missingIds.length > 0) {
        warnings.push(`The following input cues were dropped by the model: ${missingIds.join(", ")}`);
        // Optional: We could re-insert them with original text if "Safe Mode" was on,
        // but typically dropped cues meant "no translation needed" or "merged into neighbor implicitly" (though unsafe).
    }

    // Serialize
    // We sort by start time to ensure valid VTT order
    newCues.sort((a, b) => a.start - b.start);

    return {
        vtt: serializeVtt(newCues),
        warnings
    };
}
