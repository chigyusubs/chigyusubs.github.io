import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChunkStatus } from "../../lib/translation";
import { useTranslationRunner } from "../useTranslationRunner";

const translationMocks = vi.hoisted(() => ({
  translateCuesMock: vi.fn(),
}));

vi.mock("../../lib/translation", async () => {
  const actual = await vi.importActual<typeof import("../../lib/translation")>(
    "../../lib/translation",
  );
  return {
    ...actual,
    translateCues: translationMocks.translateCuesMock,
  };
});

const makeChunk = (idx: number, text: string): ChunkStatus => {
  const vtt = `WEBVTT

00:00:0${idx}.000 --> 00:00:0${idx + 1}.000
${text}
`;
  return {
    idx,
    status: "ok",
    tokens_estimate: 1,
    warnings: [],
    vtt,
    raw_vtt: vtt,
    raw_model_output: "",
    chunk_vtt: vtt,
    context_vtt: "",
    prompt: "",
    started_at: 0,
    finished_at: 0,
  };
};

describe("useTranslationRunner manual edits", () => {
  beforeEach(() => {
    translationMocks.translateCuesMock.mockReset();
  });

  it("applies manual chunk overrides and restitches output", async () => {
    const first = makeChunk(0, "old-1");
    const second = makeChunk(1, "old-2");
    translationMocks.translateCuesMock.mockResolvedValue({
      ok: true,
      warnings: [],
      chunks: [first, second],
      vtt: `${first.vtt}\n${second.vtt}`,
      srt: "",
    });

    const { result } = renderHook(() => useTranslationRunner());

    await act(async () => {
      await result.current.actions.runTranslation({
        cues: [
          { start: 0, end: 1, text: "a" },
          { start: 1, end: 2, text: "b" },
        ],
        provider: "gemini",
        chunkSeconds: 1,
        chunkOverlap: 0,
        apiKey: "k",
        modelName: "m",
        targetLang: "en",
        glossary: "",
        useGlossary: false,
        customPrompt: "",
        concurrency: 1,
        temperature: 0,
        useSummary: false,
        summaryText: "",
        videoRef: null,
        safetyOff: false,
      });
    });

    const manualVtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
fixed text
`;

    await act(async () => {
      result.current.actions.setManualChunkStatus(1, manualVtt, [
        "Manual fix",
      ]);
    });

    const updated = result.current.state.result;
    expect(updated?.chunks.find((c) => c.idx === 1)?.vtt).toBe(manualVtt);
    expect(updated?.warnings).toContain("Manual fix");
    expect(updated?.vtt).toContain("fixed text");
  });
});
