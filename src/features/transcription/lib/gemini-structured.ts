/**
 * Structured transcription workflow for Gemini
 *
 * Sequential processing with adaptive chunk boundaries determined by the model.
 * Each chunk receives context from the previous chunk and suggests the next break point.
 */

import { ProviderFactory } from "../../../lib/providers/ProviderFactory";
import type { GeminiTranscriptionConfig, TranscriptionChunk, TranscriptionResult } from "../types";
import { logDebugEvent } from "../../../lib/debugState";
import { isDebugEnabled } from "../../../lib/debugToggle";
import { mergeVttChunks } from "./shared";
import {
  validateTranscriptionOutput,
  TRANSCRIPTION_JSON_SCHEMA,
  type StructuredTranscriptionOutput,
  type TranscriptionCue
} from "../../../lib/structured/TranscriptionStructuredOutput";
import { buildTranscriptionPrompt } from "../../../lib/structured/TranscriptionStructuredPrompt";
import { reconstructTranscriptionVtt, parseTimestamp, formatTimestamp } from "../../../lib/structured/TranscriptionVttReconstructor";

const FALLBACK_CHUNK_DURATION = 120; // 2 minutes
const FALLBACK_BREAK_WINDOW = 20;    // Last 20 seconds

/**
 * Transcribe a single chunk with structured output
 */
async function transcribeChunkStructured(
  config: GeminiTranscriptionConfig,
  chunkIdx: number,
  videoStart: number,      // seconds
  videoEnd: number,        // seconds
  lastTwoCues: TranscriptionCue[] | undefined,
  nextCueNumber: number,
  breakWindowDuration: number,
  runId?: number
): Promise<{
  chunk: TranscriptionChunk;
  structuredOutput: StructuredTranscriptionOutput | null;
}> {
  const startedAt = Date.now();
  const isFirstChunk = chunkIdx === 0;

  // Build prompts
  const effectiveBreakWindow = Math.min(
    Math.max(breakWindowDuration, 0),
    Math.max(videoEnd - videoStart, 0)
  );

  const promptContext = {
    isFirstChunk,
    videoStart: formatTimestamp(videoStart),
    videoEnd: formatTimestamp(videoEnd),
    breakWindowStart: formatTimestamp(
      Math.max(videoStart, videoEnd - effectiveBreakWindow)
    ),
    breakWindowEnd: formatTimestamp(videoEnd),
    lastTwoCues,
    nextCueNumber
  };

  const { systemPrompt, userPrompt } = buildTranscriptionPrompt(promptContext);
  const augmentedUserPrompt = config.prompt
    ? `${userPrompt}\n\nADDITIONAL INSTRUCTIONS:\n${config.prompt}`
    : userPrompt;

  if (isDebugEnabled()) {
    logDebugEvent({
      kind: "transcription-structured-chunk-start",
      runId,
      chunkIdx,
      message: `Starting structured chunk ${chunkIdx}`,
      data: { videoStart, videoEnd, nextCueNumber }
    });
  }

  let rawResponseText = "";
  try {
    // Create provider
    const provider = ProviderFactory.create("gemini", {
      apiKey: config.apiKey,
      modelName: config.modelName
    });

    const request: any = {
      systemPrompt,
      userPrompt: augmentedUserPrompt,
      temperature: config.temperature ?? 0,
      safetyOff: config.safetyOff,
      responseMimeType: "application/json",
      responseJsonSchema: TRANSCRIPTION_JSON_SCHEMA,
      thinkingConfig: { thinkingBudget: typeof config.thinkingBudget === "number" ? config.thinkingBudget : 0 },
      maxOutputTokens: config.maxOutputTokens,
      topP: config.topP
    };

    // Use File API with time offsets
    request.mediaUri = config.videoRef;
    request.mediaStartSeconds = videoStart;
    request.mediaEndSeconds = videoEnd;

    // Call Gemini API (structured output enforced)
    let response;
    try {
      response = await provider.generateContent(request, {
        purpose: "transcription-structured",
        chunkIdx,
        runId
      });
    } catch (err) {
      // Some models may not support thinkingConfig; retry without it if rejected
      if (err instanceof Error && err.message.includes("thinkingConfig")) {
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-structured-thinking-disabled-fallback",
            runId,
            chunkIdx,
            message: `Chunk ${chunkIdx} retrying without thinkingConfig due to API rejection`
          });
        }
        const fallbackRequest = { ...request };
        delete (fallbackRequest as any).thinkingConfig;
        response = await provider.generateContent(fallbackRequest, {
          purpose: "transcription-structured",
          chunkIdx,
          runId
        });
      } else {
        throw err;
      }
    }

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-structured-response",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} received response`,
        data: {
          responseLength: response.text.length,
          hasUsage: !!response.usage,
          textPreview: response.text.substring(0, 200)
        }
      });
    }

    // Check for empty response
    if (!response.text || response.text.trim().length === 0) {
      throw new Error("Model returned empty response. This may be due to safety filters, content policy, or model configuration issues.");
    }
    rawResponseText = response.text;

    // Parse and validate JSON
    let json: any;
    try {
      json = JSON.parse(response.text);
    } catch (parseErr) {
      // Fallback: extract JSON from markdown code block
      const match = response.text.match(/```json\n([\s\S]*?)\n```/) ||
                    response.text.match(/```\n([\s\S]*?)\n```/);
      if (match) {
        try {
          json = JSON.parse(match[1]);
        } catch {
          throw new Error(`Failed to parse JSON from code block: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`);
        }
      } else {
        throw new Error(`Failed to parse JSON response. Response preview: ${response.text.substring(0, 200)}`);
      }
    }

    const validated = validateTranscriptionOutput(json);
    const { vtt, warnings } = reconstructTranscriptionVtt(validated);

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-structured-chunk-complete",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} completed successfully`,
        data: {
          cueCount: validated.cues.length,
          suggestedBreak: validated.suggestedNextBreak,
          breakReason: validated.breakReason,
          warnings: warnings.length
        }
      });
    }

    return {
      chunk: {
        idx: chunkIdx,
        status: "ok",
        timeRange: { start: videoStart, end: videoEnd },
        vtt,
        raw_model_output: response.text,
        raw_vtt: vtt,
        warnings,
        prompt: augmentedUserPrompt,
        system_prompt: systemPrompt,
        started_at: startedAt,
        finished_at: Date.now(),
        duration_ms: Date.now() - startedAt,
        model_name: config.modelName,
        temperature: config.temperature ?? 0,
        tokens_estimate: response.usage?.totalTokens || Math.floor(response.text.length / 4)
      },
      structuredOutput: validated
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Transcription failed";

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-structured-chunk-error",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} failed: ${errorMessage}`
      });
    }

    return {
      chunk: {
        idx: chunkIdx,
        status: "failed",
        timeRange: { start: videoStart, end: videoEnd },
        vtt: "",
        raw_model_output: rawResponseText,
        raw_vtt: "",
        warnings: [errorMessage],
        prompt: augmentedUserPrompt,
        system_prompt: systemPrompt,
        started_at: startedAt,
        finished_at: Date.now(),
        duration_ms: Date.now() - startedAt,
        model_name: config.modelName,
        temperature: config.temperature ?? 0,
        tokens_estimate: 0
      },
      structuredOutput: null
    };
  }
}

/**
 * Sequential transcription workflow with adaptive chunk boundaries
 *
 * Processes video chunks one at a time, using suggested break points from
 * the model to determine chunk boundaries. Passes context between chunks
 * for improved continuity.
 */
export async function transcribeGeminiStructured(
  config: GeminiTranscriptionConfig,
  onChunkUpdate?: (chunk: TranscriptionChunk) => void,
  shouldCancel?: () => boolean,
  shouldPause?: () => Promise<void>,
  runId?: number
): Promise<TranscriptionResult> {
  const chunks: TranscriptionChunk[] = [];
  const allWarnings: string[] = [];

  const chunkDuration = Math.max(
    Number.isFinite(config.chunkLength) ? config.chunkLength : FALLBACK_CHUNK_DURATION,
    1
  );
  const configuredBreakWindow = typeof config.overlapSeconds === "number"
    ? config.overlapSeconds
    : FALLBACK_BREAK_WINDOW;
  const breakWindowDuration = Math.min(
    Math.max(configuredBreakWindow, 0),
    chunkDuration
  );

  let currentVideoStart = 0;
  let nextCueNumber = 1;
  let lastTwoCues: TranscriptionCue[] | undefined = undefined;
  let chunkIdx = 0;

  const videoDuration = Number.isFinite(config.videoDuration)
    ? (config.videoDuration as number)
    : chunkDuration; // Fallback to a single chunk if duration unknown

  if (isDebugEnabled()) {
    logDebugEvent({
      kind: "transcription-structured-start",
      runId,
      message: `Starting structured transcription`,
      data: {
        videoDuration,
        modelName: config.modelName
      }
    });
  }

  while (currentVideoStart < videoDuration) {
    // Check cancellation
    if (shouldCancel?.()) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-cancelled",
          runId,
          message: `Transcription cancelled at chunk ${chunkIdx}`
        });
      }
      break;
    }

    // Check pause
    if (shouldPause) {
      await shouldPause();
    }

    // Calculate this chunk's video end
    const currentVideoEnd = Math.min(currentVideoStart + chunkDuration, videoDuration);

    // Transcribe chunk
    const { chunk, structuredOutput } = await transcribeChunkStructured(
      config,
      chunkIdx,
      currentVideoStart,
      currentVideoEnd,
      lastTwoCues,
      nextCueNumber,
      breakWindowDuration,
      runId
    );

    chunks.push(chunk);
    allWarnings.push(...chunk.warnings);

    if (onChunkUpdate) {
      onChunkUpdate(chunk);
    }

    // If chunk failed or we're at the end, stop
    if (chunk.status === "failed" || !structuredOutput) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-structured-stopped",
          runId,
          message: chunk.status === "failed"
            ? `Stopping due to chunk ${chunkIdx} failure`
            : `Stopping due to missing structured output`,
          data: { chunkIdx }
        });
      }
      break;
    }

    // Check if this was the last chunk
    if (currentVideoEnd >= videoDuration) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-structured-complete",
          runId,
          message: `Transcription completed`,
          data: {
            totalChunks: chunks.length,
            breakReason: structuredOutput.breakReason
          }
        });
      }
      break;
    }

    // Validate suggested break window (used for QA; not for advancing the cursor)
    try {
      const suggestedBreak = parseTimestamp(structuredOutput.suggestedNextBreak);

      // Validate suggested break is reasonable (must be inside the break window)
      const minBreak = currentVideoEnd - breakWindowDuration;
      const maxBreak = currentVideoEnd;

      if (suggestedBreak < minBreak || suggestedBreak > maxBreak) {
        const warning = `Chunk ${chunkIdx}: Suggested break ${structuredOutput.suggestedNextBreak} outside window ${formatTimestamp(minBreak)}-${formatTimestamp(maxBreak)}`;
        allWarnings.push(warning);

        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-structured-break-fallback",
            runId,
            chunkIdx,
            message: warning,
            data: { suggestedBreak, minBreak, maxBreak }
          });
        }
      }
    } catch {
      const warning = `Chunk ${chunkIdx}: Failed to parse suggested break`;
      allWarnings.push(warning);

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-structured-break-parse-error",
          runId,
          chunkIdx,
          message: warning
        });
      }
    }

    // Determine next chunk start using context cues (replay last two cues)
    if (!structuredOutput.lastTwoCues || structuredOutput.lastTwoCues.length !== 2) {
      const warning = `Chunk ${chunkIdx}: Expected 2 context cues, received ${structuredOutput.lastTwoCues?.length ?? 0}, advancing by chunk length`;
      allWarnings.push(warning);
      lastTwoCues = undefined;
      currentVideoStart = currentVideoEnd;
    } else {
      try {
        const contextStart = parseTimestamp(structuredOutput.lastTwoCues[0].startTime);
        if (contextStart <= currentVideoStart) {
          const warning = `Chunk ${chunkIdx}: Context start ${structuredOutput.lastTwoCues[0].startTime} not ahead of current start ${formatTimestamp(currentVideoStart)}, advancing by chunk length`;
          allWarnings.push(warning);
          currentVideoStart = currentVideoEnd;
        } else {
          currentVideoStart = contextStart;
        }
      } catch {
        const warning = `Chunk ${chunkIdx}: Failed to parse context start, advancing by chunk length`;
        allWarnings.push(warning);
        currentVideoStart = currentVideoEnd;
      }

      lastTwoCues = structuredOutput.lastTwoCues;
      nextCueNumber = lastTwoCues[lastTwoCues.length - 1].number + 1;
    }

    chunkIdx++;
  }

  // Stitch all chunks together
  const { vtt, srt } = mergeVttChunks(
    chunks
      .filter(c => c.status === "ok")
      .map(c => ({ vtt: c.vtt, offset: 0 })) // Times are absolute (HH:MM:SS.mmm)
  );

  return {
    ok: chunks.every(c => c.status === "ok"),
    warnings: allWarnings,
    chunks,
    vtt,
    srt,
    video_ref: config.videoRef
  };
}
