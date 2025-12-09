/**
 * Convert structured transcription JSON to VTT format
 *
 * This module handles the conversion from structured JSON cues
 * (with HH:MM:SS.mmm timestamps) to VTT format (with float seconds).
 */

import { serializeVtt, type Cue } from "../vtt";
import type { StructuredTranscriptionOutput } from "./TranscriptionStructuredOutput";

/**
 * Parse timestamp string (HH:MM:SS.mmm) to seconds
 *
 * @param timestamp - Timestamp in HH:MM:SS.mmm format
 * @returns Seconds as float
 * @throws Error if format is invalid
 */
export function parseTimestamp(timestamp: string): number {
  // Accept HH:MM:SS.mmm or seconds with 1-3 decimals
  const hhmmss = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
  const secondsOnly = /^(\d+(?:\.\d{1,3})?)$/;

  const matchH = hhmmss.exec(timestamp);
  if (matchH) {
    const [, hours, minutes, seconds, milliseconds] = matchH;
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10) +
      parseInt(milliseconds, 10) / 1000
    );
  }

  const matchS = secondsOnly.exec(timestamp);
  if (matchS) {
    const seconds = parseFloat(matchS[1]);
    if (Number.isNaN(seconds)) {
      throw new Error(`Invalid seconds value: ${timestamp}`);
    }
    return seconds;
  }

  throw new Error(`Invalid timestamp format: ${timestamp}`);
}

/**
 * Format seconds to HH:MM:SS.mmm timestamp string
 *
 * @param seconds - Seconds as float
 * @returns Timestamp in HH:MM:SS.mmm format
 */
export function formatTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Reconstruct VTT from structured transcription output
 *
 * Converts JSON cues with timestamp strings to VTT format with float seconds.
 * Validates timing consistency and collects warnings for problematic cues.
 *
 * @param output - Structured transcription output from Gemini
 * @returns VTT string and array of warnings
 */
export function reconstructTranscriptionVtt(
  output: StructuredTranscriptionOutput
): { vtt: string; warnings: string[] } {
  const warnings: string[] = [];
  const cues: Cue[] = [];
  let lowPrecisionCount = 0;

  // Convert structured cues to VTT cues
  for (const cue of output.cues) {
    try {
      const start = parseTimestamp(cue.startTime);
      const end = parseTimestamp(cue.endTime);
      const fractionalPattern = /\.(\d{1,3})$/;
      const hasFraction =
        fractionalPattern.test(cue.startTime) || fractionalPattern.test(cue.endTime);
      const isWholeOrZeroFraction =
        (!fractionalPattern.test(cue.startTime) ||
          cue.startTime.endsWith(".000") ||
          cue.startTime.endsWith(".00") ||
          cue.startTime.endsWith(".0")) &&
        (!fractionalPattern.test(cue.endTime) ||
          cue.endTime.endsWith(".000") ||
          cue.endTime.endsWith(".00") ||
          cue.endTime.endsWith(".0"));
      if (!hasFraction || isWholeOrZeroFraction) {
        lowPrecisionCount += 1;
      }

      // Validate timing
      if (end <= start) {
        warnings.push(`Cue ${cue.number}: end time (${cue.endTime}) must be after start time (${cue.startTime})`);
        continue;  // Skip this cue
      }

      // Duration sanity check (warn if suspiciously long)
      const duration = end - start;
      if (duration > 60) {  // More than 1 minute per cue is unusual
        warnings.push(`Cue ${cue.number}: unusually long duration (${duration.toFixed(1)}s)`);
      }

      cues.push({
        start,
        end,
        text: cue.text
      });
    } catch (err) {
      warnings.push(
        `Cue ${cue.number}: ${err instanceof Error ? err.message : "Invalid timestamp"}`
      );
    }
  }

  if (output.cues.length > 0 && lowPrecisionCount / output.cues.length > 0.6) {
    warnings.push(
      `Most cues lack sub-second precision (${lowPrecisionCount}/${output.cues.length}); timestamps may be coarse.`
    );
  }

  // Validate chronological order and check for overlaps
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start < cues[i - 1].start) {
      warnings.push(
        `Cue ${output.cues[i].number}: starts before previous cue (${cues[i].start.toFixed(3)}s < ${cues[i - 1].start.toFixed(3)}s)`
      );
    }

    if (cues[i].start < cues[i - 1].end) {
      warnings.push(
        `Cue ${output.cues[i].number}: overlaps with previous cue (starts at ${cues[i].start.toFixed(3)}s, previous ends at ${cues[i - 1].end.toFixed(3)}s)`
      );
    }
  }

  // Generate VTT using existing serializer
  return {
    vtt: serializeVtt(cues),
    warnings
  };
}
