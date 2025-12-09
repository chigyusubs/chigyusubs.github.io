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

/**
 * Compress video using MediaRecorder on captureStream (webm/vp9+opus) at lower FPS.
 * Note: This relies on browser support for captureStream + MediaRecorder.
 */
export async function compressVideoToWebm(
  file: File,
  {
    targetFps = 5,
    onProgress,
  }: { targetFps?: number; onProgress?: (progress: number) => void } = {},
): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("Compression not available in this environment");
  }
  if (!("MediaRecorder" in window)) {
    throw new Error("MediaRecorder not supported for compression");
  }

  return new Promise<File>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    const chunks: Blob[] = [];
    let recorder: MediaRecorder | null = null;
    let duration = 0;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = "";
    };

    const handleError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error("Compression failed"));
    };

    video.onloadedmetadata = () => {
      duration = video.duration;
      const stream = (video as any).captureStream?.(targetFps) || (video as any).mozCaptureStream?.(targetFps);
      if (!stream) {
        handleError(new Error("captureStream not supported"));
        return;
      }

      try {
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9,opus",
          videoBitsPerSecond: 400_000, // keep modest
          audioBitsPerSecond: 96_000,
        });
      } catch {
        try {
          recorder = new MediaRecorder(stream, {
            mimeType: "video/webm",
            videoBitsPerSecond: 400_000,
            audioBitsPerSecond: 96_000,
          });
        } catch (err) {
          handleError(err);
          return;
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      recorder.onerror = (e) => handleError(recorder?.error || new Error("Recorder error"));
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: "video/webm" });
        const compressed = new File(
          [blob],
          `${file.name.replace(/\.[^/.]+$/, "")}-compressed.webm`,
          { type: "video/webm" },
        );
        resolve(compressed);
      };

      video.ontimeupdate = () => {
        if (duration && onProgress) {
          onProgress(Math.min(1, video.currentTime / duration));
        }
      };

      recorder.start(1000); // gather every second
      video.play().catch(handleError);

      video.onended = () => {
        recorder?.stop();
      };
    };

    video.onerror = () => {
      handleError(new Error("Failed to load video for compression"));
    };
  });
}

export { MAX_UPLOAD_BYTES };
