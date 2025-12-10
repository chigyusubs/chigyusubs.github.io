/**
 * Transcription feature types
 * Separate from translation to avoid optional fields and conditionals
 */

import type { TranscriptionCue } from "../../lib/structured/TranscriptionStructuredOutput";

/**
 * Cursor state for resuming structured transcription
 * Stores everything needed to continue from where we left off
 */
export type TranscriptionCursor = {
  nextVideoStart: number;      // Where to start the next chunk (seconds)
  nextCueNumber: number;       // Sequential cue numbering
  lastTwoCues?: TranscriptionCue[];  // Context for next chunk's prompt
  nextChunkIdx: number;        // Which chunk index to process next
  videoDuration: number;       // Total video duration (needed for loop condition)
};

export type TranscriptionChunk = {
  idx: number;
  status: "ok" | "failed" | "processing" | "waiting" | "paused";
  requiresResume?: boolean; // when true, run is auto-paused and needs manual resume after review

  // Time range (always present for transcription)
  timeRange: {
    start: number;
    end: number;
  };

  // Results
  vtt: string;
  raw_model_output: string;
  raw_vtt: string;

  // Metadata
  warnings: string[];
  prompt: string;
  system_prompt?: string;

  // Timing
  started_at: number;
  finished_at: number;
  duration_ms?: number;

  // Model info
  model_name?: string;
  temperature?: number;
  tokens_estimate: number;
};

export type TranscriptionResult = {
  ok: boolean;
  warnings: string[];
  chunks: TranscriptionChunk[];
  vtt: string;
  srt: string;
  video_ref?: string | null;
  cursor?: TranscriptionCursor;  // Resume state for structured transcription
};

export type TranscriptionProvider = "gemini" | "openai";

export type BaseTranscriptionConfig = {
  provider: TranscriptionProvider;
  videoRef: string;
  videoFile?: File;
  apiKey: string;
  chunkLength: number;
  overlapSeconds: number;
  videoDuration: number | null;
};

export type GeminiTranscriptionConfig = BaseTranscriptionConfig & {
  provider: "gemini";
  modelName: string;
  useStructuredOutput?: boolean; // Structured mode is the default path
  thinkingBudget?: number; // Thinking tokens to allow; 0 disables thinking by default
  thinkingLevel?: "low" | "high"; // Gemini 3 thinking level override
  maxOutputTokens?: number;
  topP?: number;
  prompt?: string;
  temperature?: number;
  safetyOff?: boolean;
};

export type OpenAITranscriptionConfig = BaseTranscriptionConfig & {
  provider: "openai";
  model: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
  language?: string;
  concurrency?: number;
  maxFileSizeBytes?: number;
};

export type TranscriptionConfig = GeminiTranscriptionConfig | OpenAITranscriptionConfig;
