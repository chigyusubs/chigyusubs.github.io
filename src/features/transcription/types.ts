/**
 * Transcription feature types
 * Separate from translation to avoid optional fields and conditionals
 */

export type TranscriptionChunk = {
  idx: number;
  status: "ok" | "failed" | "processing" | "waiting" | "paused";

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
  useInlineChunks?: boolean; // If true, extract and send audio chunks inline
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
