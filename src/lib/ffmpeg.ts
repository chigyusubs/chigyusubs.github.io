import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;

async function getFfmpeg() {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    await ffmpegInstance.load();
  }
  return ffmpegInstance;
}

export async function extractAudioToOggMono(input: File): Promise<File> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input.${input.name.split(".").pop() || "mp4"}`;
  const outputName = "output.ogg";

  await ffmpeg.writeFile(inputName, await fetchFile(input));
  try {
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "16k",
      "-c:a",
      "libvorbis",
      outputName,
    ]);
  } catch (err) {
    await ffmpeg.deleteFile(inputName).catch(() => { });
    throw err;
  }
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => { });
  await ffmpeg.deleteFile(outputName).catch(() => { });
  const buffer =
    data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  return new File([buffer], `${input.name.replace(/\.[^.]+$/, "")}-audio.ogg`, {
    type: "audio/ogg",
  });
}

/**
 * Extract a specific time range from media as audio
 */
export async function extractAudioChunk(
  input: File,
  startSeconds: number,
  endSeconds?: number
): Promise<File> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input.${input.name.split(".").pop() || "mp4"}`;
  const outputName = "chunk.ogg";

  await ffmpeg.writeFile(inputName, await fetchFile(input));

  const args = ["-i", inputName];

  // Seek to start position (fast seek before input)
  if (startSeconds > 0) {
    args.unshift("-ss", startSeconds.toString());
  }

  // Duration (if endSeconds specified)
  if (endSeconds !== undefined && endSeconds > startSeconds) {
    args.push("-t", (endSeconds - startSeconds).toString());
  }

  // Audio extraction and encoding
  args.push(
    "-vn",           // No video
    "-ac", "1",      // Mono
    "-ar", "16000",  // 16kHz sample rate
    "-b:a", "32k",   // 32kbps bitrate
    "-c:a", "libvorbis",
    outputName
  );

  try {
    await ffmpeg.exec(args);
  } catch (err) {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    throw err;
  }

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const chunkName = endSeconds
    ? `chunk-${startSeconds}-${endSeconds}.ogg`
    : `chunk-${startSeconds}.ogg`;

  return new File([buffer], chunkName, { type: "audio/ogg" });
}

export async function chunkMediaToOggSegments(
  input: File,
  maxSegmentSeconds: number,
): Promise<File[]> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input.${input.name.split(".").pop() || "mp4"}`;
  const outputPattern = "segment_%03d.ogg";

  await ffmpeg.writeFile(inputName, await fetchFile(input));

  try {
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "32k",
      "-c:a",
      "libvorbis",
      "-f",
      "segment",
      "-segment_time",
      String(maxSegmentSeconds),
      "-reset_timestamps",
      "1",
      outputPattern,
    ]);
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
  }

  const segments: File[] = [];
  for (let idx = 0; idx < 999; idx += 1) {
    const name = `segment_${idx.toString().padStart(3, "0")}.ogg`;
    try {
      const data = await ffmpeg.readFile(name);
      const buffer =
        data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
      const file = new File(
        [buffer],
        `${input.name.replace(/\.[^.]+$/, "")}-part-${idx + 1}.ogg`,
        { type: "audio/ogg" },
      );
      segments.push(file);
      await ffmpeg.deleteFile(name).catch(() => {});
    } catch {
      break;
    }
  }

  if (segments.length === 0) {
    throw new Error("Failed to create audio segments");
  }

  return segments;
}
