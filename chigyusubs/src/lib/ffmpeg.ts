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
    await ffmpeg.deleteFile(inputName).catch(() => {});
    throw err;
  }
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});
  const buffer =
    data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  return new File([buffer], `${input.name.replace(/\.[^.]+$/, "")}-audio.ogg`, {
    type: "audio/ogg",
  });
}
