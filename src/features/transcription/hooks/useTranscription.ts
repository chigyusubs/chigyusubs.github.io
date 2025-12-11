import { useState, useRef } from "react";
import type { TranscriptionChunk, TranscriptionConfig, TranscriptionResult, GeminiTranscriptionConfig, OpenAITranscriptionConfig } from "../types";
import type { TranscriptionSessionExport } from "../../../lib/transcriptionSession";
import { transcribeGemini, transcribeGeminiChunk, stitchGeminiChunks } from "../lib/gemini";
import { transcribeGeminiStructured } from "../lib/gemini-structured";
import { transcribeOpenAI } from "../lib/openai";
import { calculateTimeRanges } from "../lib/shared";
import { logDebugEvent } from "../../../lib/debugState";
import { isDebugEnabled } from "../../../lib/debugToggle";
import { ProviderFactory } from "../../../lib/providers/ProviderFactory";
import type { GenerateRequest } from "../../../lib/providers/types";
import {
  TRANSCRIPTION_JSON_SCHEMA,
  validateTranscriptionOutput,
} from "../../../lib/structured/TranscriptionStructuredOutput";
import { reconstructTranscriptionVtt, parseTimestamp } from "../../../lib/structured/TranscriptionVttReconstructor";
import { buildGeminiThinkingConfig } from "../lib/thinkingConfig";

let runIdCounter = 0;

export function useTranscription() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
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

      // Auto-pause if the chunk requires manual review
      if (chunk.requiresResume) {
        pausedRef.current = true;
        setIsPaused(true);
        setProgress(`Paused after chunk ${chunk.idx + 1} for review (critical warning).`);
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-paused-for-review",
            runId,
            chunkIdx: chunk.idx,
          });
        }
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
      // Preserve paused state if we paused for review
      const wasPaused = pausedRef.current;
      if (!wasPaused) {
        setIsPaused(false);
        pausedRef.current = false;
      }
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
    setIsResuming(false);
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
    setIsResuming(false);
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

  /**
   * Load a previously saved session's progress
   * This restores the result state from the saved session
   */
  const loadSession = (session: TranscriptionSessionExport) => {
    // Reset any running state
    cancelRef.current = false;
    pausedRef.current = false;
    setIsRunning(false);
    setIsPaused(session.progress.cursor ? true : false);
    setIsResuming(false);
    setError("");
    setProgress("");

    // Restore result from session
    setResult({
      ok: session.progress.chunks.every((c) => c.status === "ok") && !session.progress.cursor,
      warnings: session.progress.warnings,
      chunks: session.progress.chunks,
      vtt: session.progress.vtt,
      srt: session.progress.srt,
      cursor: session.progress.cursor,
      // video_ref will be set when user uploads video
      video_ref: null,
    });

    if (isDebugEnabled()) {
      const completedChunks = session.progress.chunks.filter((c) => c.status === "ok").length;
      logDebugEvent({
        kind: "transcription-session-loaded",
        runId: runIdRef.current,
        message: `Loaded session: ${completedChunks} chunks complete, cursor: ${session.progress.cursor ? "present" : "none"}`,
        data: {
          videoName: session.video.name,
          completedChunks,
          totalChunks: session.progress.chunks.length,
          hasCursor: !!session.progress.cursor,
        },
      });
    }
  };

  /**
   * Resume structured transcription from where it left off
   * Uses the cursor stored in the result to continue processing remaining chunks
   */
  const resumeStructured = async (config: GeminiTranscriptionConfig) => {
    const cursor = result?.cursor;
    if (!cursor) {
      // No cursor = nothing to resume, just clear pause state
      resume();
      return;
    }

    // Block double-resume if already running/resuming
    if (isRunning || isResuming) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-resume-ignored",
          runId: runIdRef.current,
          message: "Resume ignored because a run is already active",
          data: { isRunning, isResuming }
        });
      }
      return;
    }

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-resume-structured",
        runId: runIdRef.current,
        message: `Resuming structured transcription from chunk ${cursor.nextChunkIdx}`,
        data: { cursor },
      });
    }

    setIsRunning(true);
    setIsResuming(true);
    setIsPaused(false);
    setError("");
    setProgress(`Resuming from chunk ${cursor.nextChunkIdx + 1}...`);
    cancelRef.current = false;
    pausedRef.current = false;

    // Hide stale cursor while resuming to avoid duplicate Resume clicks
    setResult((prev) => prev ? { ...prev, cursor: undefined } : prev);

    // Chunk update callback for continued transcription
    const onChunkUpdate = (chunk: TranscriptionChunk) => {
      setProgress(`Transcribing chunk ${chunk.idx + 1}...`);

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-complete",
          runId: runIdRef.current,
          chunkIdx: chunk.idx,
          message: `Chunk ${chunk.idx} ${chunk.status}`,
          data: {
            status: chunk.status,
            timeRange: chunk.timeRange,
            warnings: chunk.warnings,
          },
        });
      }

      // Auto-pause if the chunk requires manual review
      if (chunk.requiresResume) {
        pausedRef.current = true;
        setIsPaused(true);
        setProgress(`Paused after chunk ${chunk.idx + 1} for review.`);
      }

      // Update result incrementally - merge with existing chunks
      setResult((prev) => {
        if (!prev) return prev;

        const existingChunks = prev.chunks;
        const existingIdx = existingChunks.findIndex((c) => c.idx === chunk.idx);

        let updatedChunks: TranscriptionChunk[];
        if (existingIdx >= 0) {
          updatedChunks = [...existingChunks];
          updatedChunks[existingIdx] = chunk;
        } else {
          updatedChunks = [...existingChunks, chunk];
        }

        updatedChunks.sort((a, b) => a.idx - b.idx);

        const { vtt, srt } = stitchGeminiChunks(updatedChunks);

        return {
          ok: updatedChunks.every((c) => c.status === "ok"),
          warnings: updatedChunks.flatMap((c) => c.warnings),
          chunks: updatedChunks,
          vtt,
          srt,
          video_ref: prev.video_ref,
          cursor: prev.cursor, // Will be updated when runner returns
        };
      });
    };

    try {
      const continuedResult = await transcribeGeminiStructured(
        config,
        onChunkUpdate,
        shouldCancel,
        shouldPause,
        runIdRef.current,
        cursor
      );

      if (!cancelRef.current) {
        // Merge continued result with existing chunks
        setResult((prev) => {
          if (!prev) return continuedResult;

          const mergedChunks = [...prev.chunks];
          for (const newChunk of continuedResult.chunks) {
            const existingIdx = mergedChunks.findIndex((c) => c.idx === newChunk.idx);
            if (existingIdx >= 0) {
              mergedChunks[existingIdx] = newChunk;
            } else {
              mergedChunks.push(newChunk);
            }
          }
          mergedChunks.sort((a, b) => a.idx - b.idx);

          const { vtt, srt } = stitchGeminiChunks(mergedChunks);

          // Deduplicate warnings
          const allWarnings = [...new Set([...prev.warnings, ...continuedResult.warnings])];

          return {
            ok: mergedChunks.every((c) => c.status === "ok") && !continuedResult.cursor,
            warnings: allWarnings,
            chunks: mergedChunks,
            vtt,
            srt,
            video_ref: prev.video_ref,
            cursor: continuedResult.cursor, // Preserve cursor if more work remains
          };
        });

        setProgress(continuedResult.cursor ? "Paused" : "");

        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-resume-complete",
            runId: runIdRef.current,
            message: continuedResult.cursor
              ? `Paused at chunk ${continuedResult.cursor.nextChunkIdx}`
              : "Transcription completed",
            data: {
              ok: continuedResult.ok,
              hasMoreWork: !!continuedResult.cursor,
            },
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Resume failed";
      setError(errorMessage);
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-resume-error",
          runId: runIdRef.current,
          message: errorMessage,
        });
      }
    } finally {
      setIsRunning(false);
      setIsResuming(false);
      // Preserve paused state if we paused for review
      const wasPaused = pausedRef.current;
      if (!wasPaused) {
        setIsPaused(false);
      }
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
      let updatedChunk: TranscriptionChunk;
      let structuredValidated: Awaited<ReturnType<typeof validateTranscriptionOutput>> | undefined;

      // If structured is enabled, retry the structured chunk using the saved prompts/timestamps
      if ((config as GeminiTranscriptionConfig).useStructuredOutput !== false && chunk.system_prompt) {
        const geminiConfig = config as GeminiTranscriptionConfig;
        const provider = ProviderFactory.create("gemini", {
          apiKey: geminiConfig.apiKey,
          modelName: geminiConfig.modelName,
        });

        const request: GenerateRequest = {
          systemPrompt: chunk.system_prompt || "",
          userPrompt: chunk.prompt || "",
          temperature: typeof chunk.temperature === "number" ? chunk.temperature : geminiConfig.temperature ?? 0,
          safetyOff: geminiConfig.safetyOff,
          responseMimeType: "application/json",
          responseJsonSchema: TRANSCRIPTION_JSON_SCHEMA,
          thinkingConfig: buildGeminiThinkingConfig(
            geminiConfig.modelName,
            geminiConfig.thinkingBudget,
            geminiConfig.thinkingLevel
          ),
          maxOutputTokens: geminiConfig.maxOutputTokens,
          topP: geminiConfig.topP,
          mediaUri: geminiConfig.videoRef,
          mediaStartSeconds: chunk.timeRange.start,
          mediaEndSeconds: chunk.timeRange.end,
        };

        const startedAt = Date.now();
        const response = await provider.generateContent(request, {
          purpose: "transcription-structured",
          chunkIdx: chunk.idx,
          runId: runIdRef.current,
        });

        let json: unknown;
        try {
          json = JSON.parse(response.text);
        } catch (parseErr) {
          const match = response.text.match(/```json\n([\s\S]*?)\n```/) ||
                        response.text.match(/```\n([\s\S]*?)\n```/);
          if (match) {
            json = JSON.parse(match[1]);
          } else {
            throw new Error(`Failed to parse JSON response. Response preview: ${response.text.substring(0, 200)}`);
          }
        }

        structuredValidated = validateTranscriptionOutput(json);
        const { vtt, warnings, hasCriticalError } = reconstructTranscriptionVtt(structuredValidated, {
          expectedStartSeconds: chunk.timeRange.start,
          expectedEndSeconds: chunk.timeRange.end,
          maxCues: 120,
          minCueDurationSeconds: 1.0,
          maxCueDurationSeconds: 12,
          maxCueTextLength: 200,
        });

        updatedChunk = {
          idx: chunk.idx,
          status: "ok",
          requiresResume: hasCriticalError,
          timeRange: chunk.timeRange,
          vtt,
          raw_model_output: response.text,
          raw_vtt: vtt,
          warnings,
          prompt: chunk.prompt,
          system_prompt: chunk.system_prompt,
          started_at: startedAt,
          finished_at: Date.now(),
          duration_ms: Date.now() - startedAt,
          model_name: geminiConfig.modelName,
          temperature: geminiConfig.temperature ?? 0,
          tokens_estimate: response.usage?.totalTokens || Math.floor(response.text.length / 4),
        };
      } else {
        updatedChunk = await transcribeGeminiChunk(
          config as GeminiTranscriptionConfig,
          chunk.timeRange,
          chunk.idx,
          runIdRef.current
        );
      }

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

      // Update the chunk in result and advance cursor if applicable
      setResult((prev) => {
        if (!prev) return prev;

        const updatedChunks = prev.chunks.map((c) =>
          c.idx === chunk.idx ? updatedChunk : c
        );

        const { vtt, srt } = stitchGeminiChunks(updatedChunks);

        // Advance cursor if:
        // 1. We have a cursor pointing to this chunk (or earlier - failed chunk)
        // 2. Retry succeeded without requiring resume
        // 3. We have structured output to extract lastTwoCues from
        let newCursor = prev.cursor;
        if (
          prev.cursor &&
          prev.cursor.nextChunkIdx === chunk.idx &&
          updatedChunk.status === "ok" &&
          !updatedChunk.requiresResume &&
          structuredValidated
        ) {
          // Calculate next position from structured output
          let nextStart = chunk.timeRange.end;
          let nextLastTwoCues = prev.cursor.lastTwoCues;
          let nextNumber = prev.cursor.nextCueNumber;

          if (structuredValidated.lastTwoCues?.length === 2) {
            try {
              const contextStart = parseTimestamp(structuredValidated.lastTwoCues[0].startTime);
              if (contextStart > chunk.timeRange.start) {
                nextStart = contextStart;
              }
            } catch {
              // Use default nextStart (chunk end)
            }
            nextLastTwoCues = structuredValidated.lastTwoCues;
            nextNumber = structuredValidated.lastTwoCues[1].number + 1;
          }

          // Check if there's more work to do
          if (nextStart >= prev.cursor.videoDuration) {
            // Transcription complete - clear cursor
            newCursor = undefined;
          } else {
            // More work remains - advance cursor
            newCursor = {
              nextVideoStart: nextStart,
              nextCueNumber: nextNumber,
              lastTwoCues: nextLastTwoCues,
              nextChunkIdx: chunk.idx + 1,
              videoDuration: prev.cursor.videoDuration,
            };
          }

          if (isDebugEnabled()) {
            logDebugEvent({
              kind: "transcription-cursor-advanced",
              runId: runIdRef.current,
              message: newCursor
                ? `Cursor advanced to chunk ${newCursor.nextChunkIdx}`
                : "Cursor cleared (transcription complete)",
              data: { newCursor },
            });
          }
        }

        return {
          ok: updatedChunks.every((c) => c.status === "ok") && !newCursor,
          warnings: updatedChunks.flatMap((c) => c.warnings),
          chunks: updatedChunks,
          vtt,
          srt,
          video_ref: prev.video_ref,
          cursor: newCursor,
        };
      });

      // If we were paused for review and the retry cleared the critical, auto-resume
      if (pausedRef.current && !updatedChunk.requiresResume) {
        pausedRef.current = false;
        setIsPaused(false);
        pauseResolversRef.current.forEach((resolve) => resolve());
        pauseResolversRef.current = [];
        setProgress("");
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-resume",
            runId: runIdRef.current,
            message: "Auto-resume after successful retry",
            data: { chunkIdx: chunk.idx },
          });
        }
      }
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
      isResuming,
      progress,
      result,
      error,
    },
    actions: {
      start,
      pause,
      resume,
      resumeStructured,
      cancel,
      reset,
      retryChunk,
      loadSession,
    },
  };
}
