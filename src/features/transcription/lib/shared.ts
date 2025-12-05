/**
 * Shared transcription utilities used by all providers
 */
import { parseVtt, serializeVtt } from "../../../lib/vtt";
import { deriveSrt } from "../../../lib/stitcher";

/**
 * Calculate time ranges for chunking media
 */
export function calculateTimeRanges(
  totalDuration: number | null,
  chunkLength: number,
  overlapSeconds: number
): Array<{ start: number; end?: number }> {
  const ranges: Array<{ start: number; end?: number }> = [];

  if (totalDuration && totalDuration > 0) {
    let start = 0;
    while (start < totalDuration) {
      const end = Math.min(totalDuration, start + chunkLength);
      ranges.push({ start, end });
      if (end >= totalDuration) break;
      start = Math.max(0, end - overlapSeconds);
      if (start >= totalDuration) break;
    }
  } else {
    // Unknown duration, transcribe whole file
    ranges.push({ start: 0, end: undefined });
  }

  return ranges;
}

/**
 * Merge VTT cues from multiple chunks into a single VTT string
 * Handles time offset merging automatically
 */
export function mergeVttChunks(
  chunks: Array<{
    vtt: string;
    offset: number; // Time offset in seconds
  }>
): { vtt: string; srt: string } {
  const allCues: Array<{ start: number; end: number; text: string }> = [];

  chunks.forEach((chunk) => {
    if (chunk.vtt) {
      try {
        const cues = parseVtt(chunk.vtt);
        // Shift by chunk's start offset
        const shifted = cues.map((cue) => ({
          start: cue.start + chunk.offset,
          end: cue.end + chunk.offset,
          text: cue.text,
        }));
        allCues.push(...shifted);
      } catch {
        // Ignore parse errors during merging
      }
    }
  });

  // Sort by start time
  const sortedCues = allCues.sort((a, b) => a.start - b.start || a.end - b.end);

  const vtt = sortedCues.length ? serializeVtt(sortedCues) : "";
  const srt = vtt ? deriveSrt(vtt) : "";

  return { vtt, srt };
}

/**
 * Merge text chunks from multiple segments
 */
export function mergeTextChunks(
  chunks: Array<{
    text: string;
    offset: number;
    index: number;
  }>
): string {
  const orderedText = chunks
    .filter((entry) => entry.text.trim())
    .sort((a, b) => a.offset - b.offset || a.index - b.index)
    .map((entry) => entry.text);

  return orderedText.join("\n\n");
}

/**
 * Validate cue integrity (no overlaps, valid timing)
 */
export function validateCueIntegrity(
  cues: Array<{ start: number; end: number; text: string }>
): string | null {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    if (cue.end <= cue.start) {
      return `Cue ${i + 1}: end time (${cue.end}) must be greater than start time (${cue.start})`;
    }
    if (i > 0) {
      const prev = cues[i - 1];
      if (cue.start < prev.end) {
        return `Cue ${i + 1}: overlaps with previous cue (starts at ${cue.start}, previous ends at ${prev.end})`;
      }
    }
  }
  return null;
}
