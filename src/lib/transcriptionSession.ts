/**
 * Transcription Session Save/Load
 *
 * Self-contained module for exporting and importing transcription progress.
 * Enables resuming transcription across browser sessions.
 *
 * Use case: Gemini free tier users limited to 20 RPD who need to spread
 * transcription over multiple days.
 */

import type {
  TranscriptionResult,
  TranscriptionChunk,
  TranscriptionCursor,
  GeminiTranscriptionConfig,
} from "../features/transcription/types";
import { TRANSCRIPTION_JSON_SCHEMA } from "./structured/TranscriptionStructuredOutput";
import { buildTranscriptionPrompt } from "./structured/TranscriptionStructuredPrompt";

/**
 * Serializable session export format
 */
export type TranscriptionSessionExport = {
  savedAt: string; // ISO timestamp

  // Video metadata (for user reference, not for resume logic)
  video: {
    name: string;
    durationSeconds: number;
  };

  // Config (everything except API key and videoRef)
  config: {
    modelName: string;
    temperature: number;
    thinkingBudget: number;
    maxOutputTokens?: number;
    topP?: number;
    safetyOff: boolean;
    chunkLengthSeconds: number;
    overlapSeconds: number;
    prompt: string; // User's custom prompt if any
  };

  // Progress state
  progress: {
    chunks: TranscriptionChunk[];
    cursor?: TranscriptionCursor;
    warnings: string[];
    vtt: string;
    srt: string;
  };

  // Schema & prompts snapshot (for debugging/replay)
  prompts: {
    systemPrompt: string; // Actual system prompt used
    userPromptTemplate: string; // Template showing structure (first chunk version)
    schema: object; // JSON schema definition
    schemaName: string; // e.g., "TranscriptionStructuredOutput"
  };
};

/**
 * Capture current prompts and schema for snapshot
 * This records what prompts/schema the current codebase uses
 */
export function capturePromptsSnapshot(): TranscriptionSessionExport["prompts"] {
  // Build prompt with dummy context to capture the template
  const dummyPrompt = buildTranscriptionPrompt({
    isFirstChunk: true,
    videoStart: "00:00:00.000",
    videoEnd: "00:02:00.000",
    breakWindowStart: "00:01:40.000",
    breakWindowEnd: "00:02:00.000",
    nextCueNumber: 1,
  });

  return {
    systemPrompt: dummyPrompt.systemPrompt,
    userPromptTemplate: dummyPrompt.userPrompt,
    schema: TRANSCRIPTION_JSON_SCHEMA,
    schemaName: "TranscriptionStructuredOutput",
  };
}

/**
 * Create a session export from current state
 */
export function createSessionExport(
  result: TranscriptionResult,
  config: GeminiTranscriptionConfig,
  videoMeta: { name: string; durationSeconds: number }
): TranscriptionSessionExport {
  return {
    savedAt: new Date().toISOString(),
    video: {
      name: videoMeta.name,
      durationSeconds: videoMeta.durationSeconds,
    },
    config: {
      modelName: config.modelName,
      temperature: config.temperature ?? 0.2,
      thinkingBudget: config.thinkingBudget ?? 0,
      maxOutputTokens: config.maxOutputTokens,
      topP: config.topP,
      safetyOff: config.safetyOff ?? false,
      chunkLengthSeconds: config.chunkLength,
      overlapSeconds: config.overlapSeconds,
      prompt: config.prompt ?? "",
    },
    progress: {
      chunks: result.chunks,
      cursor: result.cursor,
      warnings: result.warnings,
      vtt: result.vtt,
      srt: result.srt,
    },
    prompts: capturePromptsSnapshot(),
  };
}

/**
 * Parse and validate a session import from JSON string
 * @throws Error if validation fails
 */
export function parseSessionImport(json: string): TranscriptionSessionExport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}`
    );
  }

  // Basic structure validation
  if (!data || typeof data !== "object") {
    throw new Error("Session data must be an object");
  }

  const session = data as Record<string, unknown>;

  // Required fields
  if (!session.savedAt || typeof session.savedAt !== "string") {
    throw new Error("Missing or invalid 'savedAt' field");
  }

  if (!session.video || typeof session.video !== "object") {
    throw new Error("Missing or invalid 'video' field");
  }

  if (!session.config || typeof session.config !== "object") {
    throw new Error("Missing or invalid 'config' field");
  }

  if (!session.progress || typeof session.progress !== "object") {
    throw new Error("Missing or invalid 'progress' field");
  }

  // Validate video metadata
  const video = session.video as Record<string, unknown>;
  if (!video.name || typeof video.name !== "string") {
    throw new Error("Missing or invalid 'video.name' field");
  }
  if (
    video.durationSeconds === undefined ||
    typeof video.durationSeconds !== "number"
  ) {
    throw new Error("Missing or invalid 'video.durationSeconds' field");
  }

  // Validate config
  const config = session.config as Record<string, unknown>;
  if (!config.modelName || typeof config.modelName !== "string") {
    throw new Error("Missing or invalid 'config.modelName' field");
  }

  // Validate progress
  const progress = session.progress as Record<string, unknown>;
  if (!Array.isArray(progress.chunks)) {
    throw new Error("Missing or invalid 'progress.chunks' field");
  }

  // Prompts are optional (for backward compatibility with older saves)
  // If missing, we'll use current codebase prompts on resume

  return session as unknown as TranscriptionSessionExport;
}

/**
 * Trigger browser download of session as JSON file
 */
export function downloadSession(
  session: TranscriptionSessionExport,
  filename?: string
): void {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const defaultFilename = generateFilename(session.video.name);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the session export
 */
function generateFilename(videoName: string): string {
  const baseName = videoName.replace(/\.[^.]+$/, ""); // Remove extension
  const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `transcription-progress-${sanitized}-${date}.json`;
}

/**
 * Get summary of loaded session for UI display
 */
export function getSessionSummary(session: TranscriptionSessionExport): {
  videoName: string;
  videoDuration: number;
  completedChunks: number;
  totalExpectedChunks: number;
  hasRemainingWork: boolean;
  savedAt: Date;
} {
  const completedChunks = session.progress.chunks.filter(
    (c) => c.status === "ok"
  ).length;

  // Estimate total chunks based on cursor or actual chunks
  const totalExpectedChunks = session.progress.cursor
    ? Math.ceil(
        session.video.durationSeconds / session.config.chunkLengthSeconds
      )
    : session.progress.chunks.length;

  return {
    videoName: session.video.name,
    videoDuration: session.video.durationSeconds,
    completedChunks,
    totalExpectedChunks,
    hasRemainingWork: !!session.progress.cursor,
    savedAt: new Date(session.savedAt),
  };
}

/**
 * Check if loaded session's video duration matches uploaded video
 * Returns warning message if mismatch, null if OK
 */
export function checkVideoDurationMatch(
  session: TranscriptionSessionExport,
  uploadedDuration: number
): string | null {
  const savedDuration = session.video.durationSeconds;
  const diff = Math.abs(savedDuration - uploadedDuration);

  // Allow 2 second tolerance for rounding differences
  if (diff > 2) {
    return `Video duration mismatch: saved session was for ${savedDuration.toFixed(1)}s video, but uploaded video is ${uploadedDuration.toFixed(1)}s. Make sure you're using the same video file.`;
  }

  return null;
}
