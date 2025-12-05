import type { Cue } from "./vtt";
import { parseVtt } from "./vtt";

export function stripCodeBlockWrappers(text: string): {
  cleaned: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let cleaned = text;

  // Match markdown code block syntax with optional language qualifier
  const codeBlockRegex = /^```(?:\w+)?\s*\n([\s\S]*?)\n?```$/s;
  const match = codeBlockRegex.exec(cleaned);

  if (match) {
    cleaned = match[1];
    warnings.push("Removed code block wrapper from output");
  }

  return { cleaned, warnings };
}

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

function normalizeTimecodeSegment(segment: string): string | null {
  // Remove any non-digit/dot/colon characters first
  const digits = Array.from(segment.matchAll(/\d+/g)).map((m) => m[0]);
  if (digits.length < 3) return null;

  let ms = digits.pop() || "0";
  let sec = digits.pop() || "0";
  let min = digits.pop() || "0";
  const hour = digits.pop() || "0";

  const pad2 = (val: string) => val.padStart(2, "0");
  const pad3 = (val: string) => val.padStart(3, "0").slice(0, 3);

  return `${pad2(hour)}:${pad2(min)}:${pad2(sec)}.${pad3(ms)}`;
}

function sanitizeTimecodes(text: string): { cleaned: string; warnings: string[] } {
  const warnings: string[] = [];
  const lines = normalizeNewlines(text).split("\n");
  const cleanedLines = lines.map((line) => {
    if (!line.includes("-->")) return line;
    const [rawStart, rawEnd] = line.split("-->");
    const start = normalizeTimecodeSegment(rawStart || "");
    const end = normalizeTimecodeSegment(rawEnd || "");
    if (start && end) {
      if (line.trim() !== `${start} --> ${end}`) {
        warnings.push("Sanitized malformed timecode line");
      }
      return `${start} --> ${end}`;
    }
    return line;
  });
  return { cleaned: cleanedLines.join("\n"), warnings };
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
  const codeBlockResult = stripCodeBlockWrappers(vttText);
  const headerResult = stripDuplicateHeaders(codeBlockResult.cleaned);
  const sanitizeResult = sanitizeTimecodes(headerResult.cleaned);
  const blankResult = ensureBlankLines(sanitizeResult.cleaned);
  const repaired = normalizeNewlines(blankResult.cleaned);
  return {
    repaired,
    warnings: [
      ...codeBlockResult.warnings,
      ...headerResult.warnings,
      ...sanitizeResult.warnings,
      ...blankResult.warnings,
    ],
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
