/**
 * OpenAI transcription implementation
 * Supports Whisper (VTT output) and GPT-4o (text output)
 */
import { chunkMediaToOggSegments, extractAudioToOggMono } from "../../../lib/ffmpeg";
import { getMediaDuration } from "../../../lib/mediaDuration";
import { ProviderFactory } from "../../../lib/providers/ProviderFactory";
import type { OpenAIProvider } from "../../../lib/providers/OpenAIProvider";
import { logDebugEvent } from "../../../lib/debugState";
import { isDebugEnabled } from "../../../lib/debugToggle";
import { mergeVttChunks, mergeTextChunks } from "./shared";
import type { TranscriptionChunk, OpenAITranscriptionConfig, TranscriptionResult } from "../types";

/**
 * Transcribe a single chunk with OpenAI
 */
async function transcribeOpenAIChunk(
  provider: OpenAIProvider,
  file: File,
  config: OpenAITranscriptionConfig,
  chunkIdx: number,
  offset: number,
  chunkDuration?: number,
  runId?: number
): Promise<TranscriptionChunk> {
  const startedAt = Date.now();

  if (isDebugEnabled()) {
    logDebugEvent({
      kind: "transcription-chunk-start",
      runId,
      chunkIdx,
      message: `Starting OpenAI chunk ${chunkIdx} (offset: ${offset}s)`,
      data: { offset, chunkDuration },
    });
  }

  try {
    if (!provider.transcribeAudio) {
      throw new Error("Provider does not support audio transcription");
    }

    const content = await provider.transcribeAudio(
      file,
      config.language,
      chunkDuration,
      config.model
    );

    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-chunk-api-response",
        runId,
        chunkIdx,
        message: `Chunk ${chunkIdx} received response`,
        data: { responseLength: content.length },
      });
    }

    const isGpt4o = config.model.includes("gpt-4o");
    const warnings: string[] = [];

    return {
      idx: chunkIdx,
      status: "ok",
      timeRange: {
        start: offset,
        end: chunkDuration ? offset + chunkDuration : 0,
      },
      vtt: isGpt4o ? "" : content, // Whisper returns VTT, GPT-4o returns text
      raw_model_output: content,
      raw_vtt: content,
      warnings,
      prompt: `Transcribe the attached audio${config.language ? ` in ${config.language}` : ""}.`,
      system_prompt: "",
      started_at: startedAt,
      finished_at: Date.now(),
      duration_ms: Date.now() - startedAt,
      model_name: config.model,
      temperature: 0,
      tokens_estimate: Math.max(Math.floor(content.length / 4), 1),
    };
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
      timeRange: {
        start: offset,
        end: chunkDuration ? offset + chunkDuration : 0,
      },
      vtt: "",
      raw_model_output: "",
      raw_vtt: "",
      warnings: [errorMessage],
      prompt: "",
      system_prompt: "",
      started_at: startedAt,
      finished_at: Date.now(),
      duration_ms: Date.now() - startedAt,
      model_name: config.model,
      temperature: 0,
      tokens_estimate: 0,
    };
  }
}

/**
 * Main OpenAI transcription function
 */
export async function transcribeOpenAI(
  config: OpenAITranscriptionConfig,
  onChunkUpdate?: (chunk: TranscriptionChunk) => void,
  shouldCancel?: () => boolean,
  shouldPause?: () => Promise<void>,
  runId?: number
): Promise<TranscriptionResult> {
  const provider = ProviderFactory.create("openai", {
    apiKey: config.apiKey,
    modelName: config.model,
  }) as OpenAIProvider;

  const maxFileSizeBytes = config.maxFileSizeBytes ?? 25 * 1024 * 1024; // 25MB default
  const isGpt4o = config.model.includes("gpt-4o");

  let workingFile = config.videoFile!;
  let duration: number | undefined;

  // Detect duration
  try {
    const detectedDuration = await getMediaDuration(workingFile);
    duration = detectedDuration ?? undefined;
  } catch {
    duration = undefined;
  }

  const shouldChunk =
    isGpt4o &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > config.chunkLength;

  const filesToTranscribe: Array<{ file: File; offset: number }> = [];

  if (shouldChunk) {
    if (isDebugEnabled()) {
      logDebugEvent({
        kind: "transcription-start",
        runId,
        message: `Chunking ${duration}s audio into ${config.chunkLength}s segments`,
      });
    }

    const segments = await chunkMediaToOggSegments(workingFile, config.chunkLength);
    segments.forEach((segment, idx) => {
      filesToTranscribe.push({ file: segment, offset: idx * config.chunkLength });
    });
  } else {
    // Compress large files
    if (workingFile.size > maxFileSizeBytes) {
      if (isDebugEnabled()) {
        logDebugEvent({
          kind: "transcription-compress",
          runId,
          message: `Compressing ${(workingFile.size / 1024 / 1024).toFixed(1)}MB file`,
        });
      }
      workingFile = await extractAudioToOggMono(workingFile);
    }

    filesToTranscribe.push({ file: workingFile, offset: 0 });
  }

  const chunks: TranscriptionChunk[] = [];
  const concurrency = config.concurrency ?? 1;
  const totalChunks = filesToTranscribe.length;

  if (concurrency > 1) {
    // Concurrent processing
    let nextChunk = 0;

    const runWorker = async () => {
      while (true) {
        if (shouldCancel?.()) break;
        if (shouldPause) await shouldPause();

        const current = nextChunk;
        nextChunk += 1;
        if (current >= totalChunks) return;

        const { file: chunkFile, offset } = filesToTranscribe[current];
        const chunkDuration =
          typeof duration === "number"
            ? Math.min(config.chunkLength, Math.max(0, duration - offset))
            : undefined;

        const chunk = await transcribeOpenAIChunk(
          provider,
          chunkFile,
          config,
          current,
          offset,
          chunkDuration,
          runId
        );

        chunks.push(chunk);
        if (onChunkUpdate) {
          onChunkUpdate(chunk);
        }
      }
    };

    const workerCount = Math.min(concurrency, totalChunks);
    await Promise.all(Array.from({ length: workerCount }).map(() => runWorker()));
  } else {
    // Sequential processing
    for (let i = 0; i < filesToTranscribe.length; i++) {
      if (shouldCancel?.()) break;
      if (shouldPause) await shouldPause();

      const { file: chunkFile, offset } = filesToTranscribe[i];
      const chunkDuration =
        typeof duration === "number"
          ? Math.min(config.chunkLength, Math.max(0, duration - offset))
          : undefined;

      const chunk = await transcribeOpenAIChunk(
        provider,
        chunkFile,
        config,
        i,
        offset,
        chunkDuration,
        runId
      );

      chunks.push(chunk);
      if (onChunkUpdate) {
        onChunkUpdate(chunk);
      }
    }
  }

  // Sort chunks by index
  chunks.sort((a, b) => a.idx - b.idx);

  // Merge results
  let vtt = "";
  let srt = "";

  if (isGpt4o) {
    // GPT-4o returns plain text
    const textChunks = chunks
      .filter((c) => c.status === "ok")
      .map((c) => ({
        text: c.raw_model_output,
        offset: c.timeRange.start,
        index: c.idx,
      }));
    const mergedText = mergeTextChunks(textChunks);
    vtt = mergedText;
    srt = mergedText;
  } else {
    // Whisper returns VTT
    const vttChunks = chunks
      .filter((c) => c.status === "ok")
      .map((c) => ({
        vtt: c.vtt,
        offset: c.timeRange.start,
      }));
    const merged = mergeVttChunks(vttChunks);
    vtt = merged.vtt;
    srt = merged.srt;
  }

  return {
    ok: chunks.every((c) => c.status === "ok"),
    warnings: chunks.flatMap((c) => c.warnings),
    chunks,
    vtt,
    srt,
    video_ref: config.videoRef,
  };
}
