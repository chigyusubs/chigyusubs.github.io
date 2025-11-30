import { describe, expect, it } from "vitest";

import { chunkCues } from "../chunker";

const mkCue = (start: number, end: number, text: string) => ({
  start,
  end,
  text,
});

describe("chunkCues", () => {
  it("splits cues by target duration and preserves overlap cues", () => {
    const cues = [
      mkCue(0, 5, "a"),
      mkCue(5, 10, "b"),
      mkCue(10, 15, "c"),
      mkCue(15, 20, "d"),
    ];
    const chunks = chunkCues(cues, 12, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].cues.map((c) => c.text)).toEqual(["a", "b"]);
    expect(chunks[1].cues.map((c) => c.text)).toEqual(["c", "d"]);
    expect(chunks[1].prevContext.map((c) => c.text)).toEqual(["a", "b"]);
  });

  it("handles no overlap", () => {
    const cues = [mkCue(0, 5, "a"), mkCue(5, 10, "b")];
    const chunks = chunkCues(cues, 6, 0);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].prevContext).toEqual([]);
  });
});
