import { useState, useRef } from "react";
import type { TranscriptionChunk, TranscriptionConfig, TranscriptionResult, GeminiTranscriptionConfig, OpenAITranscriptionConfig } from "../types";
import { transcribeGemini, transcribeGeminiChunk, stitchGeminiChunks } from "../lib/gemini";
import { transcribeOpenAI } from "../lib/openai";
import { calculateTimeRanges } from "../lib/shared";
import { logDebugEvent } from "../../../lib/debugState";
import { isDebugEnabled } from "../../../lib/debugToggle";

let runIdCounter = 0;

export function useTranscription() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState("");

  const cancelRef = useRef(false);
  const pausedRef = useRef(false);
  const pauseResolversRef = useRef<Array<() => void>>([]);
  const runIdRef = useRef<number>(0);

  const shouldCancel = () => cancelRef.current;

  const shouldPause = async () => {
    while (pausedRef.current) {
      await new Promise<void>((resolve) => {
        pauseResolversRef.current.push(resolve);
      });
      if (cancelRef.current) break;
    }
  };

  const start = async (config: TranscriptionConfig) => {
    const runId = ++runIdCounter;
    runIdRef.current = runId;

    setIsRunning(true);
    setIsPaused(false);
    setError("");
    setProgress("Starting transcription...");
    cancelRef.current = false;
    pausedRef.current = false;

    // Pre-compute time ranges to get total chunk count
    const ranges = calculateTimeRanges(
      config.videoDuration,
      config.chunkLength,
      config.overlapSeconds
    );

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-start",
        runId,
        message: `Starting transcription with ${ranges.length} chunks`,
        data: {
          totalChunks: ranges.length,
          chunkLength: config.chunkLength,
          overlapSeconds: config.overlapSeconds,
          videoDuration: config.videoDuration,
          modelName: config.modelName,
        },
      });
    }

    // Initialize result with pending chunks
    const pendingChunks: TranscriptionChunk[] = ranges.map((range, idx) => ({
      idx,
      status: "waiting" as const,
      timeRange: {
        start: range.start,
        end: range.end ?? 0,
      },
      vtt: "",
      raw_model_output: "",
      raw_vtt: "",
      warnings: [],
      prompt: config.prompt || "",
      system_prompt: "",
      started_at: 0,
      finished_at: 0,
      duration_ms: 0,
      model_name: config.modelName,
      temperature: config.temperature ?? 0.2,
      tokens_estimate: 0,
    }));

    setResult({
      ok: false,
      warnings: [],
      chunks: pendingChunks,
      vtt: "",
      srt: "",
      video_ref: config.videoRef,
    });

    // Chunk update callback (shared by both providers)
    const onChunkUpdate = (chunk: TranscriptionChunk) => {
      // Update progress
      setProgress(`Transcribing chunk ${chunk.idx + 1}/${ranges.length}...`);

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-complete",
          runId,
          chunkIdx: chunk.idx,
          message: `Chunk ${chunk.idx} ${chunk.status}`,
          data: {
            status: chunk.status,
            timeRange: chunk.timeRange,
            warnings: chunk.warnings,
            tokensEstimate: chunk.tokens_estimate,
            durationMs: chunk.duration_ms,
          },
        });
      }

      // Update result incrementally
      setResult((prev) => {
        const chunks = prev?.chunks || [];
        const existingIdx = chunks.findIndex((c) => c.idx === chunk.idx);

        let updatedChunks: TranscriptionChunk[];
        if (existingIdx >= 0) {
          updatedChunks = [...chunks];
          updatedChunks[existingIdx] = chunk;
        } else {
          updatedChunks = [...chunks, chunk];
        }

        updatedChunks.sort((a, b) => a.idx - b.idx);

        const { vtt, srt } = stitchGeminiChunks(updatedChunks);

        return {
          ok: updatedChunks.every((c) => c.status === "ok"),
          warnings: updatedChunks.flatMap((c) => c.warnings),
          chunks: updatedChunks,
          vtt,
          srt,
          video_ref: config.videoRef,
        };
      });
    };

    try {
      let transcriptionResult: TranscriptionResult;

      // Dispatch to the correct provider
      if (config.provider === "openai") {
        transcriptionResult = await transcribeOpenAI(
          config as OpenAITranscriptionConfig,
          onChunkUpdate,
          shouldCancel,
          shouldPause,
          runId
        );
      } else {
        // Gemini
        transcriptionResult = await transcribeGemini(
          config as GeminiTranscriptionConfig,
          onChunkUpdate,
          shouldCancel,
          shouldPause,
          runId
        );
      }

      if (!cancelRef.current) {
        setResult(transcriptionResult);
        setProgress("");
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-complete",
            runId,
            message: `Transcription completed, ${transcriptionResult.chunks.length} chunks processed`,
            data: {
              ok: transcriptionResult.ok,
              totalWarnings: transcriptionResult.warnings.length,
            },
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transcription failed";
      setError(errorMessage);
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-error",
          runId,
          message: errorMessage,
        });
      }
    } finally {
      setIsRunning(false);
      setIsPaused(false);
      pausedRef.current = false;
    }
  };

  const pause = () => {
    pausedRef.current = true;
    setIsPaused(true);
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-pause",
        runId: runIdRef.current,
        message: "Transcription paused",
      });
    }
  };

  const resume = () => {
    pausedRef.current = false;
    setIsPaused(false);
    // Resolve all waiting promises
    pauseResolversRef.current.forEach((resolve) => resolve());
    pauseResolversRef.current = [];
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-resume",
        runId: runIdRef.current,
        message: "Transcription resumed",
      });
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    pausedRef.current = false;
    // Resolve any waiting promises
    pauseResolversRef.current.forEach((resolve) => resolve());
    pauseResolversRef.current = [];
    setProgress("");
    setIsRunning(false);
    setIsPaused(false);
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-cancel",
        runId: runIdRef.current,
        message: "Transcription cancelled",
      });
    }
  };

  const reset = () => {
    setResult(null);
    setProgress("");
    setError("");
    setIsRunning(false);
    setIsPaused(false);
    cancelRef.current = false;
    pausedRef.current = false;
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-reset",
        runId: runIdRef.current,
        message: "Transcription reset",
      });
    }
  };

  const retryChunk = async (
    chunk: TranscriptionChunk,
    config: TranscriptionConfig
  ) => {
    setError("");

    // Only Gemini supports chunk retry currently
    // OpenAI would need to re-extract audio file which is more complex
    if (config.provider !== "gemini") {
      setError("Chunk retry is only supported for Gemini transcription");
      return;
    }

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-retry-start",
        runId: runIdRef.current,
        chunkIdx: chunk.idx,
        message: `Retrying chunk ${chunk.idx}`,
        data: {
          previousStatus: chunk.status,
          timeRange: chunk.timeRange,
        },
      });
    }

    try {
      const updatedChunk = await transcribeGeminiChunk(
        config as GeminiTranscriptionConfig,
        chunk.timeRange,
        chunk.idx,
        runIdRef.current
      );

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-retry-complete",
          runId: runIdRef.current,
          chunkIdx: chunk.idx,
          message: `Retry complete for chunk ${chunk.idx}, status: ${updatedChunk.status}`,
          data: {
            status: updatedChunk.status,
            warnings: updatedChunk.warnings,
          },
        });
      }

      // Update the chunk in result
      setResult((prev) => {
        if (!prev) return prev;

        const updatedChunks = prev.chunks.map((c) =>
          c.idx === chunk.idx ? updatedChunk : c
        );

        const { vtt, srt } = stitchGeminiChunks(updatedChunks);

        return {
          ok: updatedChunks.every((c) => c.status === "ok"),
          warnings: updatedChunks.flatMap((c) => c.warnings),
          chunks: updatedChunks,
          vtt,
          srt,
          video_ref: prev.video_ref,
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Chunk retry failed";
      setError(errorMessage);
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-retry-error",
          runId: runIdRef.current,
          chunkIdx: chunk.idx,
          message: errorMessage,
        });
      }
    }
  };

  return {
    state: {
      isRunning,
      isPaused,
      progress,
      result,
      error,
    },
    actions: {
      start,
      pause,
      resume,
      cancel,
      reset,
      retryChunk,
    },
  };
}
