import { ProviderFactory } from "./providers/ProviderFactory";
import type { ProviderType } from "./providers/types";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const WEB_CODECS_BASELINE_CONFIG = {
  codec: "avc1.42E01E", // H.264 baseline
  width: 640,
  height: 480,
  framerate: 5,
};
const WEB_CODECS_AUDIO_CONFIG = {
  codec: "mp4a.40.2", // AAC LC
  numberOfChannels: 1,
  sampleRate: 48000,
  bitrate: 96000,
};

export type PreparedMedia = {
  file: File;
  isAudio: boolean;
  duration: number | null;
  sizeMb: number;
  name: string | null;
};

export async function prepareMediaFile(
  file: File,
  {
    useAudioOnly,
    getMediaDuration,
    extractAudioToOggMono,
  }: {
    useAudioOnly: boolean;
    getMediaDuration: (file: File) => Promise<number | null>;
    extractAudioToOggMono: (file: File) => Promise<File>;
  },
): Promise<PreparedMedia> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "File exceeds 2GB limit (Gemini File API + in-browser processing). Please trim or compress.",
    );
  }

  let mediaFile = file;
  const isAudio = mediaFile.type.startsWith("audio/");
  if (useAudioOnly && !isAudio) {
    mediaFile = await extractAudioToOggMono(file);
  }

  const duration = await getMediaDuration(mediaFile);

  return {
    file: mediaFile,
    isAudio: mediaFile.type.startsWith("audio/"),
    duration: duration && Number.isFinite(duration) ? duration : null,
    sizeMb: mediaFile.size / (1024 * 1024),
    name: mediaFile.name || null,
  };
}

export async function uploadMediaToProvider(
  provider: ProviderType,
  {
    apiKey,
    modelName,
    baseUrl,
    file,
  }: {
    apiKey?: string;
    modelName: string;
    baseUrl?: string;
    file: File;
  },
): Promise<{ fileUri: string; fileName?: string }> {
  if (provider !== "gemini") {
    throw new Error(`${provider} does not support persisted media upload`);
  }

  const providerInstance = ProviderFactory.create(provider, {
    apiKey,
    modelName,
    baseUrl,
  });

  if (!providerInstance.uploadMedia) {
    throw new Error(`${provider} does not support media upload`);
  }

  return providerInstance.uploadMedia(file);
}

export async function detectWebCodecsSupport(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!(window.VideoEncoder && window.AudioEncoder && window.VideoEncoder.isConfigSupported && window.AudioEncoder.isConfigSupported)) {
    return false;
  }
  try {
    const video = await (window as any).VideoEncoder.isConfigSupported?.(WEB_CODECS_BASELINE_CONFIG);
    const audio = await (window as any).AudioEncoder.isConfigSupported?.(WEB_CODECS_AUDIO_CONFIG);
    return Boolean(video?.supported && audio?.supported);
  } catch {
    return false;
  }
}

export { MAX_UPLOAD_BYTES };
