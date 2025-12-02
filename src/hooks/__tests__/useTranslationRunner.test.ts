import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useTranslationRunner } from "../useTranslationRunner";

type TranslateCuesOpts = Parameters<
  typeof import("../../lib/translation").translateCues
>[0];
type ChunkStatus = import("../../lib/translation").ChunkStatus;

const translationMocks = vi.hoisted(() => ({
  translateCuesMock: vi.fn(),
  translateChunkFromTextMock: vi.fn(),
}));

vi.mock("../../lib/translation", async () => {
  const actual = await vi.importActual<typeof import("../../lib/translation")>(
    "../../lib/translation",
  );
  return {
    ...actual,
    translateCues: translationMocks.translateCuesMock,
    translateChunkFromText: translationMocks.translateChunkFromTextMock,
  };
});

describe("useTranslationRunner", () => {
  const baseOpts = {
    chunkSeconds: 600,
    chunkOverlap: 2,
    apiKey: "key",
    modelName: "model",
    targetLang: "en",
    glossary: "",
    useGlossary: false,
    customPrompt: "",
    concurrency: 2,
    temperature: 0.2,
    useSummary: false,
    summaryText: "",
    videoRef: null as string | null,
  };

  const mkChunk = (idx = 0): ChunkStatus => ({
    idx,
    status: "ok",
    tokens_estimate: 1,
    warnings: [],
    vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi",
    raw_vtt: "",
    raw_model_output: "",
    chunk_vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi",
    context_vtt: "",
    prompt: "",
    started_at: 0,
    finished_at: 0,
  });

  beforeEach(() => {
    translationMocks.translateCuesMock.mockReset();
    translationMocks.translateChunkFromTextMock.mockReset();
  });

  it("runs translation and updates progress/result", async () => {
    translationMocks.translateCuesMock.mockImplementation(
      async (opts: TranslateCuesOpts) => {
        opts.onChunkUpdate?.(mkChunk());
        return {
          ok: true,
          warnings: [],
          chunks: [mkChunk()],
          vtt: "WEBVTT",
          srt: "SRT",
          video_ref: null,
        };
      },
    );

    const { result } = renderHook(() => useTranslationRunner());

    await act(async () => {
      await result.current.actions.runTranslation({
        ...baseOpts,
        cues: [{ start: 0, end: 1, text: "hi" }],
      });
    });

    expect(translationMocks.translateCuesMock).toHaveBeenCalled();
    expect(result.current.state.result?.ok).toBe(true);
    expect(result.current.state.progress).toContain("Completed chunk");
  });

  it("retries a chunk and clears retrying state", async () => {
    // Seed initial result
    translationMocks.translateCuesMock.mockResolvedValue({
      ok: true,
      warnings: [],
      chunks: [mkChunk()],
      vtt: "WEBVTT",
      srt: "SRT",
      video_ref: null,
    });

    translationMocks.translateChunkFromTextMock.mockResolvedValue({
      ...mkChunk(),
      vtt: "UPDATED",
    });

    const { result } = renderHook(() => useTranslationRunner());

    await act(async () => {
      await result.current.actions.runTranslation({
        ...baseOpts,
        cues: [{ start: 0, end: 1, text: "hi" }],
      });
    });

    await act(async () => {
      await result.current.actions.retryChunk({
        chunk: mkChunk(),
        apiKey: baseOpts.apiKey,
        modelName: baseOpts.modelName,
        targetLang: baseOpts.targetLang,
        glossary: baseOpts.glossary,
        useGlossary: baseOpts.useGlossary,
        customPrompt: baseOpts.customPrompt,
        temperature: baseOpts.temperature,
        useSummary: baseOpts.useSummary,
        summaryText: baseOpts.summaryText,
      });
    });

    expect(translationMocks.translateChunkFromTextMock).toHaveBeenCalled();
    expect(result.current.state.result?.chunks[0].vtt).toBe("UPDATED");
  });
});
