import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  translateChunkFromText,
  translateChunkStructured,
  translateCues,
} from "../translation";

const providerState = vi.hoisted(() => ({
  impl: vi.fn(),
  createdConfigs: [] as unknown[],
}));

vi.mock("../providers/ProviderFactory", async (importOriginal) => {
  const original = await importOriginal();
  const ProviderFactoryOriginal = (original as { ProviderFactory: { create: (...args: unknown[]) => unknown } }).ProviderFactory;

  return {
    ...original,
    ProviderFactory: {
      ...ProviderFactoryOriginal,
      create: vi.fn((_type, config) => {
        providerState.createdConfigs.push(config);
        return {
          generateContent: (...args: unknown[]) => providerState.impl(...args),
        };
      }),
    },
  };
});

const chunkVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hi there
`;

describe("translation pipeline", () => {
  beforeEach(() => {
    providerState.impl.mockReset();
    providerState.createdConfigs = [];
  });

  it("adjusts translated cue timecodes back to the source and emits a warning", async () => {
    providerState.impl.mockResolvedValue({
      text: `WEBVTT

00:00:00.500 --> 00:00:01.500
translated line
`,
    });

    const result = await translateChunkFromText({
      idx: 0,
      chunkVtt,
      contextVtt: "",
      provider: "gemini",
      apiKey: "key",
      modelName: "model",
      baseUrl: undefined,
      targetLang: "en",
      glossary: "",
      customPrompt: "",
      temperature: 0,
      summaryText: undefined,
      useGlossary: false,
      safetyOff: false,
    });

    expect(result.status).toBe("ok");
    expect(result.warnings).toContain("Adjusted cue timecodes to match source");
    expect(result.vtt).toContain("00:00:00.000 --> 00:00:01.000");
  });

  it("parses structured output inside fenced JSON blocks", async () => {
    providerState.impl.mockResolvedValue({
      text: "```json\n{\"translations\":[{\"id\":1,\"text\":\"hello\"},{\"id\":2,\"text\":\"world\"}]}\n```",
    });

    const structured = await translateChunkStructured({
      idx: 0,
      chunkVtt: `WEBVTT

00:00:00.000 --> 00:00:01.000
cue 1

00:00:01.500 --> 00:00:02.500
cue 2
`,
      contextVtt: "",
      provider: "gemini",
      apiKey: "key",
      modelName: "model",
      baseUrl: undefined,
      targetLang: "en",
      glossary: "",
      customPrompt: "",
      temperature: 0,
      summaryText: undefined,
      useGlossary: false,
      safetyOff: false,
      structuredCueHintMode: "duration",
    });

    expect(structured.status).toBe("ok");
    expect(structured.warnings).toHaveLength(0);
    expect(structured.vtt).toContain("hello");
    expect(structured.vtt).toContain("world");
  });

  it("honors cancellation before making provider calls", async () => {
    providerState.impl.mockImplementation(() => {
      throw new Error("provider should not be called when cancelled");
    });

    const cues = [
      { start: 0, end: 1, text: "a" },
      { start: 1.2, end: 2.2, text: "b" },
    ];

    const result = await translateCues({
      cues,
      provider: "gemini",
      apiKey: "key",
      modelName: "model",
      baseUrl: undefined,
      targetLang: "en",
      glossary: "",
      customPrompt: "",
      summaryText: undefined,
      useGlossary: false,
      targetSeconds: 1,
      overlap: 0,
      concurrency: 2,
      temperature: 0,
      safetyOff: false,
      useStructuredOutput: false,
      structuredCueHintMode: "duration",
      shouldCancel: () => true,
      shouldPause: () => false,
    });

    expect(providerState.impl).not.toHaveBeenCalled();
    expect(result.chunks.every((c) => c.status === "failed")).toBe(true);
    expect(result.chunks.every((c) => c.warnings.includes("Cancelled"))).toBe(
      true,
    );
  });
});
