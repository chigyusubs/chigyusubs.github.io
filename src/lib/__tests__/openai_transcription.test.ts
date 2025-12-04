import { describe, it, expect, vi, beforeEach } from "vitest";
import { transcribeOpenAiMedia } from "../transcription/openai";

// Mock dependencies
vi.mock("../ffmpeg", () => ({
  chunkMediaToOggSegments: vi.fn(),
  extractAudioToOggMono: vi.fn(async (f: File) => f),
}));

vi.mock("../mediaDuration", () => ({
  getMediaDuration: vi.fn(),
}));

vi.mock("../vtt", async () => {
  const actual = await vi.importActual<typeof import("../vtt")>("../vtt");
  return {
    ...actual,
    parseVtt: vi.fn(),
    serializeVtt: vi.fn(actual.serializeVtt),
  };
});

import { chunkMediaToOggSegments, extractAudioToOggMono } from "../ffmpeg";
import { getMediaDuration } from "../mediaDuration";
import { parseVtt } from "../vtt";

// Simple provider mock
const makeProvider = () =>
  ({
    transcribeAudio: vi.fn(),
  } as unknown as import("../providers/OpenAIProvider").OpenAIProvider);

const newFile = (name: string, size = 1) =>
  new File(["x".repeat(size)], name, { type: "text/plain" });

describe("transcribeOpenAiMedia", () => {
  const chunkMediaToOggSegmentsMock = vi.mocked(chunkMediaToOggSegments);
  const extractAudioToOggMonoMock = vi.mocked(extractAudioToOggMono);
  const getMediaDurationMock = vi.mocked(getMediaDuration);
  const parseVttMock = vi.mocked(parseVtt);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chunks GPT-4o inputs and preserves order with concurrency", async () => {
    const provider = makeProvider();
    const file = newFile("media.mp4");
    getMediaDurationMock.mockResolvedValue(130); // seconds
    chunkMediaToOggSegmentsMock.mockResolvedValue([newFile("part1"), newFile("part2")]);
    provider.transcribeAudio = vi
      .fn()
      .mockResolvedValueOnce("chunk-one")
      .mockResolvedValueOnce("chunk-two");

    const statuses: string[] = [];

    const result = await transcribeOpenAiMedia({
      file,
      provider,
      model: "gpt-4o-transcribe",
      language: "en",
      chunkSeconds: 60,
      concurrency: 2,
      maxFileSizeBytes: 25 * 1024 * 1024,
      onStatus: (s) => statuses.push(s),
    });

    expect(chunkMediaToOggSegmentsMock).toHaveBeenCalledTimes(1);
    expect(provider.transcribeAudio).toHaveBeenCalledTimes(2);
    expect(result.isVtt).toBe(false);
    expect(result.text).toBe("chunk-one\n\nchunk-two"); // ordered by offset
    expect(statuses.some((s) => s.includes("Splitting media"))).toBe(true);
    expect(statuses.some((s) => s.includes("Transcribing chunk 1/2"))).toBe(true);
  });

  it("skips chunking for Whisper and merges VTT cues", async () => {
    const provider = makeProvider();
    const file = newFile("audio.wav");
    getMediaDurationMock.mockResolvedValue(500); // still should not chunk for whisper
    const vttContent = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n\n";
    provider.transcribeAudio = vi.fn().mockResolvedValue(vttContent);
    parseVttMock.mockReturnValue([{ start: 0, end: 1, text: "Hi" }]);

    const result = await transcribeOpenAiMedia({
      file,
      provider,
      model: "whisper-1",
      chunkSeconds: 60,
      concurrency: 2,
      maxFileSizeBytes: 25 * 1024 * 1024,
      onStatus: () => {},
    });

    expect(chunkMediaToOggSegmentsMock).not.toHaveBeenCalled();
    expect(provider.transcribeAudio).toHaveBeenCalledTimes(1);
    expect(result.isVtt).toBe(true);
    expect(result.text).toContain("WEBVTT");
  });

  it("compresses large single inputs before sending", async () => {
    const provider = makeProvider();
    const largeFile = newFile("big.mp4", 30 * 1024 * 1024); // 30MB
    getMediaDurationMock.mockResolvedValue(50);
    provider.transcribeAudio = vi.fn().mockResolvedValue("text");
    const statuses: string[] = [];

    await transcribeOpenAiMedia({
      file: largeFile,
      provider,
      model: "gpt-4o-transcribe",
      chunkSeconds: 120,
      concurrency: 1,
      maxFileSizeBytes: 25 * 1024 * 1024,
      onStatus: (s) => statuses.push(s),
    });

    expect(extractAudioToOggMonoMock).toHaveBeenCalledTimes(1);
    expect(statuses.some((s) => s.toLowerCase().includes("converting"))).toBe(true);
  });
});
