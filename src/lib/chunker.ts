import type { Cue } from "./vtt";

export type Chunk = {
  idx: number;
  cues: Cue[];
  prevContext: Cue[];
};

export function chunkCues(
  cues: Cue[],
  targetSeconds = 600,
  overlapCues = 2,
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Cue[] = [];
  let prevTail: Cue[] = [];
  cues.forEach((cue) => {
    if (current.length === 0) {
      current.push(cue);
      return;
    }
    const tentative = [...current, cue];
    const duration = tentative[tentative.length - 1].end - tentative[0].start;
    if (duration > targetSeconds) {
      chunks.push({ idx: chunks.length, cues: current, prevContext: prevTail });
      prevTail = overlapCues > 0 ? current.slice(-overlapCues) : [];
      current = [cue];
    } else {
      current.push(cue);
    }
  });
  if (current.length > 0) {
    chunks.push({ idx: chunks.length, cues: current, prevContext: prevTail });
  }
  return chunks;
}
