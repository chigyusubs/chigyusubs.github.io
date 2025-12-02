import { afterEach, describe, expect, it, vi } from "vitest";

const geminiState = vi.hoisted(() => ({ active: 0, maxActive: 0 }));

vi.mock("../gemini", () => {
  const translateChunkText = vi.fn(async (opts: { userPrompt: string }) => {
    geminiState.active += 1;
    geminiState.maxActive = Math.max(geminiState.maxActive, geminiState.active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    geminiState.active -= 1;
    const chunk =
      opts.userPrompt.split("### CUES TO TRANSLATE ###\n")[1]?.trim() ?? "";
    // Ensure the returned text is valid VTT format
    return { text: chunk };
  });

  class GeminiTranslationError extends Error {}

  return { translateChunkText, GeminiTranslationError };
});

import { translateCues } from "../translation";
import type { Cue } from "../vtt";
import { serializeVtt } from "../vtt";

const mkCue = (start: number): Cue => ({
  start,
  end: start + 1,
  text: `cue-${start}`,
});

describe("translateCues", () => {
  afterEach(() => {
    vi.clearAllMocks();
    geminiState.active = 0;
    geminiState.maxActive = 0;
  });

  it("clamps concurrency to a maximum of 10 while processing all chunks", async () => {
    const cues = Array.from({ length: 12 }, (_, idx) => mkCue(idx));

    const result = await translateCues({
      cues,
      apiKey: "key",
      modelName: "model",
      targetLang: "en",
      glossary: "",
      customPrompt: "",
      videoUri: null,    // Add missing required parameter
      videoLabel: null,  // Add missing required parameter
      mediaKind: undefined, // Add missing required parameter
      targetSeconds: 1,
      overlap: 0,
      concurrency: 50,
      safetyOff: false,
      shouldPause: () => false,
      shouldCancel: () => false,
      onChunkUpdate: () => {},
    });

    expect(geminiState.maxActive).toBeLessThanOrEqual(10);
    expect(result.chunks.length).toBe(cues.length);
    // Log the status of each chunk for debugging
    result.chunks.forEach((chunk, index) => {
      if (chunk.status !== "ok") {
        console.log(`Chunk ${index} status: ${chunk.status}, warnings:`, chunk.warnings);
      }
    });
    expect(result.chunks.every((c) => c.status === "ok")).toBe(true);
  });
});
