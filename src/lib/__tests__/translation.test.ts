import { afterEach, describe, expect, it, vi } from "vitest";

const callState = vi.hoisted(() => ({ active: 0, maxActive: 0 }));

vi.mock("../providers/ProviderFactory", async (importOriginal) => {
  const original = await importOriginal();
  const ProviderFactoryOriginal = (original as { ProviderFactory: { create: (...args: unknown[]) => unknown } }).ProviderFactory;

  class MockProvider {
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
    config: Record<string, unknown>;
    readonly type = "gemini";
    readonly capabilities = {
      supportsMediaUpload: true,
      supportsVision: true,
      supportsTemperature: true,
      supportsSafetySettings: true,
      requiresApiKey: true,
      supportsStreaming: false,
    };

    async generateContent(opts: { userPrompt: string }) {
      callState.active += 1;
      callState.maxActive = Math.max(callState.maxActive, callState.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      callState.active -= 1;
      const chunk =
        opts.userPrompt.split("### CUES TO TRANSLATE ###\n")[1]?.trim() ?? "";
      // Ensure the returned text is valid VTT format
      return { text: chunk };
    }

    validateConfig() {
      return true;
    }

    async listModels() {
      return [];
    }
  }

  // Mock the ProviderFactory to return our mock provider
  const mockProviderFactory = {
    ...ProviderFactoryOriginal,
    create: vi.fn((_type, config) => new MockProvider(config as Record<string, unknown>)),
  };

  return { ...original, ProviderFactory: mockProviderFactory };
});

import { translateCues } from "../translation";
import type { Cue } from "../vtt";

const mkCue = (start: number): Cue => ({
  start,
  end: start + 1,
  text: `cue-${start}`,
});

describe("translateCues", () => {
  afterEach(() => {
    vi.clearAllMocks();
    callState.active = 0;
    callState.maxActive = 0;
  });

  it("clamps concurrency to a maximum of 10 while processing all chunks", async () => {
    const cues = Array.from({ length: 12 }, (_, idx) => mkCue(idx));

    const result = await translateCues({
      cues,
      provider: "gemini", // Added required provider field
      apiKey: "key",
      modelName: "model",
      baseUrl: "https://generativelanguage.googleapis.com", // Added required baseUrl field
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

    expect(callState.maxActive).toBeLessThanOrEqual(10);
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
