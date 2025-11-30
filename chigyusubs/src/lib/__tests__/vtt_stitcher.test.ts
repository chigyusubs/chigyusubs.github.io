import { describe, expect, it } from "vitest";

import { stitchVtt } from "../stitcher";
import { parseVtt, serializeVtt, toSrt } from "../vtt";

const cues = [
  { start: 0, end: 1, text: "first" },
  { start: 1, end: 2, text: "second" },
];

describe("vtt + stitcher", () => {
  it("round-trips VTT serialization and parsing", () => {
    const vtt = serializeVtt(cues);
    const parsed = parseVtt(vtt);
    expect(parsed).toEqual(cues);
    expect(parseVtt(serializeVtt(parsed))).toEqual(cues);
  });

  it("stitches parts and strips duplicate headers", () => {
    const partA = serializeVtt([cues[0]]);
    const partB = serializeVtt([cues[1]]);
    const stitched = stitchVtt([partA, partB]);
    const stitchedCues = parseVtt(stitched);
    expect(stitchedCues).toHaveLength(2);
    expect(stitchedCues[0].text).toBe("first");
    expect(stitchedCues[1].text).toBe("second");
  });

  it("converts VTT output to SRT", () => {
    const vtt = serializeVtt(cues);
    const srt = toSrt(vtt);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:01,000\nfirst");
    expect(srt).toContain("2\n00:00:01,000 --> 00:00:02,000\nsecond");
  });
});
