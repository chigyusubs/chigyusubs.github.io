import { ProviderFactory } from "../../../lib/providers/ProviderFactory";
import type { GenerateRequest } from "../../../lib/providers/types";
import { parseVtt, serializeVtt } from "../../../lib/vtt";
import { autoRepairVtt } from "../../../lib/validator";
import type { TranscriptionChunk, GeminiTranscriptionConfig, TranscriptionResult } from "../types";
import { logDebugEvent } from "../../../lib/debugState";
import { isDebugEnabled } from "../../../lib/debugToggle";
import { extractAudioChunk } from "../../../lib/ffmpeg";
import { validateCueIntegrity, mergeVttChunks } from "./shared";

const DEFAULT_SYSTEM_PROMPT =
  "You are a professional transcriber. Output MUST be valid WebVTT with accurate timestamps.";

const DEFAULT_USER_PROMPT =
  "Transcribe the attached media to WebVTT. Preserve original language and timing with accurate timestamps. Return ONLY WebVTT text.";

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:audio/ogg;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type ParseResult = {
  cues: ReturnType<typeof parseVtt> | null;
  warnings: string[];
};


function tryParseVttFlexible(text: string): ParseResult {
  const warnings: string[] = [];
  try {
    const cues = parseVtt(text);
    return { cues, warnings };
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : "Failed to parse VTT");
    return { cues: null, warnings };
  }
}

/**
 * Transcribe a single chunk with Gemini
 */
export async function transcribeGeminiChunk(
  config: GeminiTranscriptionConfig,
  timeRange: { start: number; end?: number },
  chunkIdx: number,
  runId?: number
): Promise<TranscriptionChunk> {
  const systemPrompt = DEFAULT_SYSTEM_PROMPT;
  const userPrompt = config.prompt || DEFAULT_USER_PROMPT;
  const startedAt = Date.now();

  if (isDebugEnabled()) {
    logDebugEvent({
      kind: "transcription-chunk-start",
      runId,
      chunkIdx,
      message: `Starting chunk ${chunkIdx} (${timeRange.start}s - ${timeRange.end ?? "end"}s)`,
      data: { timeRange },
    });
  }

  try {
    const provider = ProviderFactory.create("gemini", {
      apiKey: config.apiKey,
      modelName: config.modelName,
    });

    const request: GenerateRequest = {
      systemPrompt,
      userPrompt,
      temperature: config.temperature ?? 0.2,
      safetyOff: config.safetyOff,
    };

    // Use inline chunking if enabled and video file is available
    if (config.useInlineChunks && config.videoFile) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-extract-audio",
          runId,
          chunkIdx,
          message: `Chunk ${chunkIdx} extracting audio (${timeRange.start}s - ${timeRange.end ?? "end"}s)`,
        });
      }

      // Extract audio chunk using ffmpeg
      const audioChunk = await extractAudioChunk(
        config.videoFile,
        timeRange.start,
        timeRange.end
      );

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-encode-audio",
          runId,
          chunkIdx,
          message: `Chunk ${chunkIdx} encoding audio to base64`,
          data: {
            audioSize: audioChunk.size,
            audioType: audioChunk.type,
          },
        });
      }

      // Convert to base64
      const base64Data = await fileToBase64(audioChunk);

      request.mediaInlineData = {
        mimeType: audioChunk.type,
        data: base64Data,
      };

      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-inline-ready",
          runId,
          chunkIdx,
          message: `Chunk ${chunkIdx} inline data ready`,
          data: {
            base64Length: base64Data.length,
            estimatedMB: (base64Data.length / 1024 / 1024).toFixed(2),
          },
        });
      }
    } else {
      // Use File API with time offsets (original approach)
      request.mediaUri = config.videoRef;
      request.mediaStartSeconds = timeRange.start;
      request.mediaEndSeconds = timeRange.end;
    }

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-chunk-api-call",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} calling Gemini API`,
        data: {
          usingInlineData: !!request.mediaInlineData,
          mediaStartSeconds: request.mediaStartSeconds,
          mediaEndSeconds: request.mediaEndSeconds,
        },
      });
    }

    const response = await provider.generateContent(request, {
      purpose: "transcription",
      chunkIdx,
    });

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-chunk-api-response",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} received API response`,
        data: {
          responseLength: response.text.length,
        },
      });
    }

    const text = response.text.trim();
    const repair = autoRepairVtt(text);
    const parsed = tryParseVttFlexible(repair.repaired);
    const warnings: string[] = [];

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-chunk-parse",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} parsed, ${parsed.cues?.length ?? 0} cues found`,
        data: {
          parsedCues: parsed.cues?.length ?? 0,
          parseWarnings: parsed.warnings.length,
          hadRepairs: repair.repaired !== text,
        },
      });
    }

    if (parsed.warnings.length) {
      parsed.warnings.forEach((w) => warnings.push(`Chunk ${chunkIdx}: ${w}`));
    }

    if (parsed.cues) {
      // Shift timecodes by chunk start offset
      const shifted = parsed.cues.map((cue) => ({
        ...cue,
        start: cue.start + timeRange.start,
        end: cue.end + timeRange.start,
      }));

      const integrityError = validateCueIntegrity(shifted);
      if (integrityError) {
        warnings.push(`Chunk ${chunkIdx}: ${integrityError}`);
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: "transcription-chunk-validation-fail",
            runId,
            chunkIdx,
            message: `Chunk ${chunkIdx} validation failed: ${integrityError}`,
          });
        }
      }

      const stitchedChunk = serializeVtt(parsed.cues);

      return {
        idx: chunkIdx,
        status: integrityError ? "failed" : "ok",
        timeRange: { start: timeRange.start, end: timeRange.end ?? 0 },
        vtt: stitchedChunk,
        raw_model_output: text,
        raw_vtt: stitchedChunk,
        warnings: integrityError ? [integrityError] : warnings,
        prompt: userPrompt,
        system_prompt: systemPrompt,
        started_at: startedAt,
        finished_at: Date.now(),
        duration_ms: Date.now() - startedAt,
        model_name: config.modelName,
        temperature: config.temperature ?? 0.2,
        tokens_estimate: Math.max(Math.floor(stitchedChunk.length / 4), 1),
      };
    } else {
      // Parse failed
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-chunk-parse-fail",
          runId,
          chunkIdx,
          message: `Chunk ${chunkIdx} parse failed`,
          data: { warnings: parsed.warnings },
        });
      }

      return {
        idx: chunkIdx,
        status: "failed",
        timeRange: { start: timeRange.start, end: timeRange.end ?? 0 },
        vtt: "",
        raw_model_output: text,
        raw_vtt: text,
        warnings: parsed.warnings,
        prompt: userPrompt,
        system_prompt: systemPrompt,
        started_at: startedAt,
        finished_at: Date.now(),
        duration_ms: Date.now() - startedAt,
        model_name: config.modelName,
        temperature: config.temperature ?? 0.2,
        tokens_estimate: Math.max(Math.floor(text.length / 4), 1),
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Transcription failed";
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-chunk-error",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} error: ${errorMessage}`,
      });
    }

    return {
      idx: chunkIdx,
      status: "failed",
      timeRange: { start: timeRange.start, end: timeRange.end ?? 0 },
      vtt: "",
      raw_model_output: "",
      raw_vtt: "",
      warnings: [errorMessage],
      prompt: userPrompt,
      system_prompt: systemPrompt,
      started_at: startedAt,
      finished_at: Date.now(),
      duration_ms: Date.now() - startedAt,
      model_name: config.modelName,
      temperature: config.temperature ?? 0.2,
      tokens_estimate: 0,
    };
  }
}

/**
 * Stitch all successful chunks into final VTT/SRT using shared utilities
 */
export function stitchGeminiChunks(
  chunks: TranscriptionChunk[]
): { vtt: string; srt: string } {
  const successfulChunks = chunks
    .filter((c) => c.status === "ok")
    .map((chunk) => ({
      vtt: chunk.vtt,
      offset: chunk.timeRange.start,
    }));

  return mergeVttChunks(successfulChunks);
}

/**
 * Main Gemini transcription function
 */
export async function transcribeGemini(
  config: GeminiTranscriptionConfig,
  onChunkUpdate?: (chunk: TranscriptionChunk) => void,
  shouldCancel?: () => boolean,
  shouldPause?: () => Promise<void>,
  runId?: number
): Promise<TranscriptionResult> {
  const ranges = calculateTimeRanges(
    config.videoDuration,
    config.chunkLength,
    config.overlapSeconds
  );

  const chunks: TranscriptionChunk[] = [];
  const allWarnings: string[] = [];

  for (let i = 0; i < ranges.length; i++) {
    // Check for cancellation
    if (shouldCancel?.()) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-cancelled",
          runId,
          message: `Transcription cancelled at chunk ${i}`,
          data: { processedChunks: i, totalChunks: ranges.length },
        });
      }
      break;
    }

    // Check for pause
    if (shouldPause) {
      await shouldPause();
    }

    const chunk = await transcribeGeminiChunk(config, ranges[i], i, runId);
    chunks.push(chunk);
    allWarnings.push(...chunk.warnings);

    if (onChunkUpdate) {
      onChunkUpdate(chunk);
    }
  }

  const { vtt, srt } = stitchGeminiChunks(chunks);

  return {
    ok: chunks.every((c) => c.status === "ok"),
    warnings: allWarnings,
    chunks,
    vtt,
    srt,
    video_ref: config.videoRef,
  };
}
