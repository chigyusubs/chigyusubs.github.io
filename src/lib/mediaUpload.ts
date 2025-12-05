import { ProviderFactory } from "./providers/ProviderFactory";
import type { ProviderType } from "./providers/types";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

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
  const providerInstance = ProviderFactory.create(provider, {
    apiKey,
    modelName,
    baseUrl: provider === "ollama" ? baseUrl : undefined,
  });

  if (!providerInstance.uploadMedia) {
    throw new Error(`${provider} does not support media upload`);
  }

  return providerInstance.uploadMedia(file);
}

export { MAX_UPLOAD_BYTES };
