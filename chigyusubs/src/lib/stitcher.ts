import { parseVtt, serializeVtt, toSrt } from "./vtt";

export function stitchVtt(parts: string[]): string {
  const cues = parts.flatMap((part) => {
    const cleaned = part.trim().toUpperCase().startsWith("WEBVTT")
      ? part.split("\n").slice(1).join("\n")
      : part;
    return parseVtt(cleaned);
  });
  return serializeVtt(cues);
}

export function deriveSrt(finalVtt: string): string {
  return toSrt(finalVtt);
}
