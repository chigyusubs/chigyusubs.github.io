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

function formatSecondsToHMS(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);
  const pad = (n: number, len: number) => n.toString().padStart(len, "0");
  return `${pad(hr, 2)}:${pad(min, 2)}:${pad(sec, 2)}.${pad(ms, 3)}`;
}

function parseFlexibleTimecode(raw: string): number | null {
  const cleaned = raw.replace(/[^\d:.]/g, "");
  if (!cleaned) return null;
  const parts = cleaned.split(":").filter((p) => p.length > 0);

  const parseSec = (val: string): number | null => {
    const num = Number.parseFloat(val);
    return Number.isFinite(num) ? num : null;
  };

  if (parts.length === 1) {
    // Could be seconds.millis
    return parseSec(parts[0]);
  }

  if (parts.length === 2) {
    const min = Number.parseInt(parts[0], 10);
    const sec = parseSec(parts[1]);
    if (!Number.isFinite(min) || sec === null) return null;
    return min * 60 + sec;
  }

  if (parts.length >= 3) {
    const hr = Number.parseInt(parts[parts.length - 3], 10);
    const min = Number.parseInt(parts[parts.length - 2], 10);
    const sec = parseSec(parts[parts.length - 1]);
    if (!Number.isFinite(hr) || !Number.isFinite(min) || sec === null) return null;
    return hr * 3600 + min * 60 + sec;
  }

  return null;
}

function sanitizeTimecodes(text: string): { cleaned: string; warnings: string[] } {
  const warnings: string[] = [];
  const lines = normalizeNewlines(text).split("\n");
  const cleanedLines = lines.map((line) => {
    if (!line.includes("-->")) return line;
    const [rawStart, rawEnd] = line.split("-->");
    const startSeconds = parseFlexibleTimecode(rawStart || "");
    const endSeconds = parseFlexibleTimecode(rawEnd || "");
    if (startSeconds !== null && endSeconds !== null) {
      const start = formatSecondsToHMS(startSeconds);
      const end = formatSecondsToHMS(endSeconds);
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
