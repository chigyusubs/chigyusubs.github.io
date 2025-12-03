import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChunkStatus, TranslateResult } from "../../lib/translation";

const translationMocks = vi.hoisted(() => ({
  translateCuesMock: vi.fn(),
  translateChunkFromTextMock: vi.fn(),
}));

vi.mock("../../lib/translation", () => ({
  translateCues: translationMocks.translateCuesMock,
  translateChunkFromText: translationMocks.translateChunkFromTextMock,
}));

import { useTranslationRunner } from "../useTranslationRunner";

const makeChunk = (idx: number): ChunkStatus => ({
  idx,
  status: "ok",
  tokens_estimate: 1,
  warnings: [],
  vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nline",
  raw_vtt: "",
  raw_model_output: "",
  chunk_vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nline",
  context_vtt: "",
  prompt: "",
  started_at: 0,
  finished_at: 0,
});

describe("useTranslationRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates progress and result on a successful translation run", async () => {
    const chunk = makeChunk(0);
    translationMocks.translateCuesMock.mockImplementation(async (opts) => {
      opts.onChunkUpdate?.(chunk);
      const result: TranslateResult = {
        ok: true,
        warnings: [],
        chunks: [chunk],
        vtt: chunk.vtt,
        srt: "1\n00:00:00,000 --> 00:00:01,000\nline",
      };
      return result;
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
        useGlossary: true,
        customPrompt: "",
        concurrency: 2,
        temperature: 0.1,
        useSummary: false,
        summaryText: "",
        videoRef: null,
        safetyOff: false,
      });
    });

    expect(result.current.state.result?.ok).toBe(true);
    expect(result.current.state.progress).toContain("Completed chunk 1/1");
  });

  it("deduplicates retry requests for the same chunk", async () => {
    const chunk = makeChunk(0);
    translationMocks.translateCuesMock.mockResolvedValue({
      ok: true,
      warnings: [],
      chunks: [chunk],
      vtt: chunk.vtt,
      srt: "",
    });
    translationMocks.translateChunkFromTextMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return chunk;
    });

    const { result } = renderHook(() => useTranslationRunner());

    await act(async () => {
      await result.current.actions.runTranslation({
        cues: [{ start: 0, end: 1, text: "a" }],
        provider: "gemini",
        chunkSeconds: 1,
        chunkOverlap: 0,
        apiKey: "k",
        modelName: "m",
        targetLang: "en",
        glossary: "",
        useGlossary: true,
        customPrompt: "",
        concurrency: 2,
        temperature: 0.1,
        useSummary: false,
        summaryText: "",
        videoRef: null,
        safetyOff: false,
      });
    });

    await act(async () => {
      await result.current.actions.retryChunk({
        chunk: result.current.state.result!.chunks[0],
        provider: "gemini",
        apiKey: "k",
        modelName: "m",
        targetLang: "en",
        glossary: "",
        useGlossary: true,
        customPrompt: "",
        temperature: 0.1,
        useSummary: false,
        summaryText: "",
        safetyOff: false,
        concurrency: 2,
      });
      await result.current.actions.retryChunk({
        chunk: result.current.state.result!.chunks[0],
        provider: "gemini",
        apiKey: "k",
        modelName: "m",
        targetLang: "en",
        glossary: "",
        useGlossary: true,
        customPrompt: "",
        temperature: 0.1,
        useSummary: false,
        summaryText: "",
        safetyOff: false,
        concurrency: 2,
      });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(translationMocks.translateChunkFromTextMock).toHaveBeenCalledTimes(
      1,
    );
  });
});
