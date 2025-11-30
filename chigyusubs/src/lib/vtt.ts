export type Cue = {
  start: number;
  end: number;
  text: string;
};

const timePattern =
  /(?:(?<hour>\d{2}):)?(?<minute>\d{2}):(?<second>\d{2})[.,](?<milli>\d{3})/;

class VttParseError extends Error {}

function timeToSeconds(timecode: string): number {
  const match = timePattern.exec(timecode.trim());
  if (!match || !match.groups) {
    throw new VttParseError(`Invalid timecode: ${timecode}`);
  }
  const hour = parseInt(match.groups.hour || "0", 10);
  const minute = parseInt(match.groups.minute || "0", 10);
  const second = parseInt(match.groups.second || "0", 10);
  const milli = parseInt(match.groups.milli || "0", 10);
  return hour * 3600 + minute * 60 + second + milli / 1000;
}

function secondsToTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export function parseVtt(text: string): Cue[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace("\ufeff", ""));
  const cues: Cue[] = [];
  let idx = 0;
  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (
      !line ||
      line.toUpperCase().startsWith("WEBVTT") ||
      !line.includes("-->")
    ) {
      idx += 1;
      continue;
    }
    let start = 0;
    let end = 0;
    try {
      const [rawStart, rawEnd] = line.split("-->").map((part) => part.trim());
      start = timeToSeconds(rawStart);
      end = timeToSeconds(rawEnd.split(" ")[0]);
    } catch (err) {
      throw new VttParseError(
        `Failed to parse timecodes on line ${idx + 1}: ${line}` +
          (err instanceof Error ? ` (${err.message})` : ""),
      );
    }
    idx += 1;
    const textLines: string[] = [];
    while (idx < lines.length && lines[idx].trim() !== "") {
      textLines.push(lines[idx]);
      idx += 1;
    }
    cues.push({ start, end, text: textLines.join("\n") });
    while (idx < lines.length && lines[idx].trim() === "") {
      idx += 1;
    }
  }
  return cues;
}

export function serializeVtt(cues: Cue[]): string {
  const parts = ["WEBVTT", ""];
  cues.forEach((cue) => {
    parts.push(`${secondsToTime(cue.start)} --> ${secondsToTime(cue.end)}`);
    parts.push(cue.text);
    parts.push("");
  });
  return `${parts.join("\n").trim()}\n`;
}

export function toSrt(vttText: string): string {
  const cues = parseVtt(vttText);
  const lines: string[] = [];
  cues.forEach((cue, idx) => {
    const start = secondsToTime(cue.start).replace(".", ",");
    const end = secondsToTime(cue.end).replace(".", ",");
    lines.push(String(idx + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(cue.text);
    lines.push("");
  });
  return `${lines.join("\n").trim()}\n`;
}

export class VttError extends Error {}

export function assertVtt(text: string): void {
  parseVtt(text);
}

export function parseSrt(text: string): Cue[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace("\ufeff", ""));
  const cues: Cue[] = [];
  let idx = 0;
  while (idx < lines.length) {
    while (idx < lines.length && lines[idx].trim() === "") {
      idx += 1;
    }
    if (idx >= lines.length) break;

    // Optional numeric index
    if (/^\d+$/.test(lines[idx].trim())) {
      idx += 1;
    }
    if (idx >= lines.length || !lines[idx].includes("-->")) {
      throw new VttParseError(
        `Failed to parse timecodes on line ${idx + 1}: ${lines[idx] ?? ""}`,
      );
    }
    const [rawStart, rawEnd] = lines[idx]
      .split("-->")
      .map((part) => part.trim());
    let start = 0;
    let end = 0;
    try {
      start = timeToSeconds(rawStart);
      end = timeToSeconds(rawEnd.split(" ")[0]);
    } catch (err) {
      throw new VttParseError(
        `Invalid timecodes on line ${idx + 1}: ${lines[idx]}` +
          (err instanceof Error ? ` (${err.message})` : ""),
      );
    }
    idx += 1;
    const textLines: string[] = [];
    while (idx < lines.length && lines[idx].trim() !== "") {
      textLines.push(lines[idx]);
      idx += 1;
    }
    cues.push({ start, end, text: textLines.join("\n") });
  }
  return cues;
}

export function srtToVtt(text: string): string {
  const cues = parseSrt(text);
  return serializeVtt(cues);
}
