import { chunkMediaToOggSegments, extractAudioToOggMono } from "../ffmpeg";
import { parseVtt, serializeVtt } from "../vtt";
import { getMediaDuration } from "../mediaDuration";
import type { OpenAIProvider } from "../providers/OpenAIProvider";

type TranscriptionResult = {
  text: string;
  isVtt: boolean;
};

type TranscriptionOptions = {
  file: File;
  provider: OpenAIProvider;
  model: string;
  language?: string;
  chunkSeconds: number;
  concurrency: number;
  maxFileSizeBytes: number;
  onStatus?: (message: string) => void;
};

/**
 * Transcribe media with OpenAI's audio models.
 * Handles optional chunking + concurrency and merges either VTT cues or text.
 */
export async function transcribeOpenAiMedia({
  file,
  provider,
  model,
  language,
  chunkSeconds,
  concurrency,
  maxFileSizeBytes,
  onStatus,
}: TranscriptionOptions): Promise<TranscriptionResult> {
  const updateStatus = (msg: string) => onStatus?.(msg);

  let workingFile = file;
  let duration: number | undefined;

  // Detect duration (best-effort)
  try {
    const detectedDuration = await getMediaDuration(file);
    duration = detectedDuration ?? undefined;
    if (duration && Number.isFinite(duration) && duration > 0) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      updateStatus(`Preparing transcription (${duration.toFixed(0)}s media, ${sizeMb}MB)...`);
    }
  } catch {
    duration = undefined;
  }

  const filesToTranscribe: Array<{ file: File; offset: number }> = [];
  const shouldChunk =
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > chunkSeconds;

  if (shouldChunk) {
    updateStatus(`Splitting media into ~${chunkSeconds}s chunks for transcription...`);
    const segments = await chunkMediaToOggSegments(workingFile, chunkSeconds);
    updateStatus(`Split into ${segments.length} chunk(s). Starting transcription...`);
    segments.forEach((segment, idx) => {
      filesToTranscribe.push({ file: segment, offset: idx * chunkSeconds });
    });
  } else {
    // Compress large inputs before sending to the API
    if (workingFile.size > maxFileSizeBytes) {
      const sizeMb = (workingFile.size / (1024 * 1024)).toFixed(1);
      updateStatus(`File too large (${sizeMb}MB), converting to compressed audio...`);
      workingFile = await extractAudioToOggMono(workingFile);
      const newSizeMb = (workingFile.size / (1024 * 1024)).toFixed(1);
      updateStatus(`Conversion complete (${newSizeMb}MB). Starting transcription...`);

      // Recheck duration after conversion (best-effort)
      try {
        const detectedDuration = await getMediaDuration(workingFile);
        duration = detectedDuration ?? duration;
      } catch {
        // keep prior duration if available
      }
    }

    filesToTranscribe.push({ file: workingFile, offset: 0 });
  }

  const isGpt4o = model.includes("gpt-4o");
  const combinedVttCues: Array<{ start: number; end: number; text: string }> = [];
  const combinedText: Array<{ offset: number; text: string; index: number }> = [];

  const totalChunks = filesToTranscribe.length;
  const workerCount = Math.min(concurrency, totalChunks);
  let nextChunk = 0;

  const runWorker = async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = nextChunk;
      nextChunk += 1;
      if (current >= totalChunks) return;

      const { file: chunkFile, offset } = filesToTranscribe[current];
      updateStatus(
        `Transcribing chunk ${current + 1}/${totalChunks}${
          workerCount > 1 ? ` (up to ${workerCount} at once)` : ""
        }...`,
      );

      const chunkDuration =
        typeof duration === "number"
          ? Math.min(chunkSeconds, Math.max(0, duration - offset))
          : undefined;

      const content = await provider.transcribeAudio(
        chunkFile,
        language,
        chunkDuration,
        model,
      );

      if (isGpt4o) {
        combinedText.push({ offset, text: content.trim(), index: current });
      } else {
        const cues = parseVtt(content);
        cues.forEach((cue) => {
          combinedVttCues.push({
            start: cue.start + offset,
            end: cue.end + offset,
            text: cue.text,
          });
        });
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }).map(() => runWorker()));

  if (isGpt4o) {
    const orderedText = combinedText
      .filter((entry) => entry.text)
      .sort((a, b) => a.offset - b.offset || a.index - b.index)
      .map((entry) => entry.text);
    return { text: orderedText.join("\n\n"), isVtt: false };
  }

  const orderedCues = combinedVttCues.sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  return { text: serializeVtt(orderedCues), isVtt: true };
}
