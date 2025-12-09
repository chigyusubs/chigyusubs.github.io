
import type { StructuredTranslationOutput } from "./StructuredOutput";
import { type Cue, serializeVtt } from "../vtt";

/**
 * Reconstructs a valid VTT string from the LLM's structured JSON output
 * and the original source cues (for timing).
 *
 * The output is expected to contain one entry per cue with an optional
 * `merge_with_next` flag. Adjacent cues marked for merge are combined
 * using their min start and max end times.
 */
export function reconstructVtt(
  output: StructuredTranslationOutput,
  originalCues: Cue[],
): { vtt: string; warnings: string[] } {
  const warnings: string[] = [];
  const newCues: Cue[] = [];

  // Build lookup and detect duplicates/invalid IDs early
  const seen = new Set<number>();
  const items = new Map<number, typeof output.translations[number]>();

  output.translations.forEach((item, idx) => {
    if (item.id < 1 || item.id > originalCues.length) {
      warnings.push(`Skipping invalid ID ${item.id} (out of bounds)`);
      return;
    }
    if (seen.has(item.id)) {
      warnings.push(`Duplicate entry for ID ${item.id} (keeping first, dropping later)`);
      return;
    }
    seen.add(item.id);
    items.set(item.id, item);
  });

  let i = 1;
  while (i <= originalCues.length) {
    const item = items.get(i);
    if (!item) {
      warnings.push(`Missing translation for cue ${i}; dropping cue.`);
      i += 1;
      continue;
    }

    let groupText = (item.text || "").trim();
    let groupStartIdx = i;
    let groupEndIdx = i;
    let mergeNext = Boolean(item.merge_with_next);

    while (mergeNext && groupEndIdx < originalCues.length) {
      const nextId = groupEndIdx + 1;
      const nextItem = items.get(nextId);
      if (!nextItem) {
        warnings.push(`merge_with_next=true on cue ${groupEndIdx} but cue ${nextId} is missing; stopping merge.`);
        break;
      }
      if ((nextItem.text || "").trim()) {
        const trimmed = nextItem.text.trim();
        groupText = groupText
          ? `${groupText} ${trimmed}`
          : trimmed;
      }
      groupEndIdx = nextId;
      mergeNext = Boolean(nextItem.merge_with_next);
    }

    const start = originalCues[groupStartIdx - 1].start;
    const end = originalCues[groupEndIdx - 1].end;

    newCues.push({
      start,
      end,
      text: groupText,
    });

    i = groupEndIdx + 1;
  }

  // Warn if some IDs never appeared
  const missingIds: number[] = [];
  for (let id = 1; id <= originalCues.length; id++) {
    if (!items.has(id)) {
      missingIds.push(id);
    }
  }
  if (missingIds.length > 0) {
    warnings.push(`The following input cues were not returned: ${missingIds.join(", ")}`);
  }

  newCues.sort((a, b) => a.start - b.start);

  return {
    vtt: serializeVtt(newCues),
    warnings,
  };
}
