import { describe, expect, it } from "vitest";

import { validateTimecodeConsistency, validateVtt } from "../validator";
import type { Cue } from "../vtt";

const mkCue = (start: number, end: number, text: string): Cue => ({
  start,
  end,
  text,
});

describe("validateTimecodeConsistency", () => {
  it("passes when counts and times match", () => {
    const original = [mkCue(0, 1, "a"), mkCue(1, 2, "b")];
    const translated = [mkCue(0, 1, "x"), mkCue(1, 2, "y")];
    const res = validateTimecodeConsistency(original, translated);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
    expect(res.fixedCues).toEqual(translated);
  });

  it("adjusts drifted times and warns", () => {
    const original = [mkCue(0, 1, "a")];
    const translated = [mkCue(0.1, 1.2, "x")];
    const res = validateTimecodeConsistency(original, translated);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toContain("Adjusted cue timecodes to match source");
    expect(res.fixedCues[0].start).toBe(0);
    expect(res.fixedCues[0].end).toBe(1);
  });

  it("errors when counts differ", () => {
    const original = [mkCue(0, 1, "a")];
    const translated = [mkCue(0, 1, "x"), mkCue(1, 2, "y")];
    const res = validateTimecodeConsistency(original, translated);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});

describe("validateVtt", () => {
  it("repairs duplicate headers and inserts missing blank lines", () => {
    const input = [
      "WEBVTT",
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:01.000",
      "hello",
      "00:00:01.000 --> 00:00:02.000",
      "world",
    ].join("\n");

    const result = validateVtt(input);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain("Removed duplicate WEBVTT header");
    expect(result.warnings.some((w) => w.includes("Inserted blank line"))).toBe(true);
  });
});
