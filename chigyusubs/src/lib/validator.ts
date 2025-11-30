import type { Cue } from "./vtt";
import { parseVtt } from "./vtt";

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripDuplicateHeaders(text: string): {
  cleaned: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = normalizeNewlines(text).split("\n");
  const cleanedLines: string[] = [];
  let headerSeen = false;
  lines.forEach((line) => {
    if (line.trim().toUpperCase().startsWith("WEBVTT")) {
      if (headerSeen) {
        warnings.push("Removed duplicate WEBVTT header");
        return;
      }
      headerSeen = true;
    }
    cleanedLines.push(line);
  });
  let cleaned = cleanedLines.join("\n");
  if (!headerSeen) {
    cleaned = `WEBVTT\n\n${cleaned.replace(/^\n+/, "")}`;
  }
  return { cleaned, warnings };
}

export function ensureBlankLines(text: string): {
  cleaned: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const parts: string[] = [];
  const lines = normalizeNewlines(text).split("\n");
  lines.forEach((line, idx) => {
    parts.push(line);
    const nextLine = lines[idx + 1] ?? "";
    const isTimeLine = line.includes("-->");
    const nextIsTimeLine = nextLine.includes("-->");
    if (!isTimeLine && line.trim() && nextIsTimeLine) {
      parts.push("");
      warnings.push("Inserted blank line between cues");
    }
  });
  return { cleaned: parts.join("\n"), warnings };
}

export function validateVtt(vttText: string): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const headerResult = stripDuplicateHeaders(vttText);
  const blankResult = ensureBlankLines(headerResult.cleaned);
  warnings.push(...headerResult.warnings, ...blankResult.warnings);
  let cues: Cue[] = [];
  try {
    cues = parseVtt(blankResult.cleaned);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unable to parse VTT");
    return { errors, warnings };
  }
  cues.forEach((cue, idx) => {
    if (cue.end <= cue.start) {
      errors.push(`Cue ${idx} has non-positive duration`);
    }
    if (idx > 0 && cue.start < cues[idx - 1].end) {
      errors.push(`Cue ${idx} starts before previous ends`);
    }
    if (cue.text.split("\n").length > 3) {
      warnings.push(`Cue ${idx} has many lines; consider splitting later`);
    }
  });
  return { errors, warnings };
}

export function autoRepairVtt(vttText: string): {
  repaired: string;
  warnings: string[];
} {
  const headerResult = stripDuplicateHeaders(vttText);
  const blankResult = ensureBlankLines(headerResult.cleaned);
  const repaired = normalizeNewlines(blankResult.cleaned);
  return {
    repaired,
    warnings: [...headerResult.warnings, ...blankResult.warnings],
  };
}

export function validateTimecodeConsistency(
  original: Cue[],
  translated: Cue[],
): { errors: string[]; warnings: string[]; fixedCues: Cue[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (original.length !== translated.length) {
    errors.push(
      `Cue count changed: expected ${original.length}, got ${translated.length}`,
    );
    return { errors, warnings, fixedCues: translated };
  }

  let adjusted = false;
  const fixedCues = translated.map((cue, idx) => {
    const source = original[idx];
    const startMatches = source.start === cue.start;
    const endMatches = source.end === cue.end;
    if (!startMatches || !endMatches) {
      adjusted = true;
      return { ...cue, start: source.start, end: source.end };
    }
    return cue;
  });

  if (adjusted) {
    warnings.push("Adjusted cue timecodes to match source");
  }

  return { errors, warnings, fixedCues };
}
