import React from "react";
import { LABELS } from "../config/ui";
import { useTheme } from "../lib/themeContext";
import {
  AUDIO_TOKENS_PER_SEC,
  VIDEO_TOKENS_PER_SEC_DEFAULT,
  VIDEO_TOKENS_PER_SEC_LOW,
} from "../config/defaults";
import { Button } from "./ui/Button";
import { SectionCard } from "./ui/SectionCard";
import { FilePicker, TextArea } from "./ui/Field";

type Props = {
  vttFile: File | null;
  setVttFile: (file: File | null) => void;
  mediaFile: File | null;
  setMediaFile: (file: File | null) => void;
  useAudioOnly: boolean;
  setUseAudioOnly: (use: boolean) => void;
  videoRef: string | null;
  videoUploadState: "idle" | "uploading" | "ready" | "error";
  videoUploadMessage: string;
  videoSizeMb: number | null;
  videoDuration: number | null;
  mediaResolution: "low" | "standard";
  handleUploadVideo: () => void;
  handleDeleteVideo: () => void;
  submitting: boolean;
  apiKey: string;
  locked: boolean;
  mediaTooLargeWarning: boolean;
  supportsMediaUpload: boolean;
  skipProviderUpload?: boolean;

  // Audio Transcription Props
  showAudioUpload?: boolean;
  audioFile?: File | null;
  setAudioFile?: (file: File | null) => void;
  transcriptionText?: string;
  setTranscriptionText?: (text: string) => void;
  transcriptionStatus?: "idle" | "loading" | "success" | "error";
  onTranscribe?: () => void;
  useTranscription?: boolean;
  setUseTranscription?: (use: boolean) => void;
  useTranscriptionForSummary?: boolean;
  setUseTranscriptionForSummary?: (use: boolean) => void;
  mode: "translation" | "transcription";
};

function formatDuration(seconds: number | null): string {
  if (
    seconds === null ||
    Number.isNaN(seconds) ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    return "n/a";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function FileUploader({
  vttFile,
  setVttFile,
  mediaFile,
  setMediaFile,
  useAudioOnly,
  setUseAudioOnly,
  videoRef,
  videoUploadState,
  videoUploadMessage,
  videoSizeMb,
  videoDuration,
  mediaResolution,
  handleUploadVideo,
  handleDeleteVideo,
  submitting,
  apiKey,
  locked,
  mediaTooLargeWarning,
  supportsMediaUpload,
  skipProviderUpload = false,

  showAudioUpload = false,
  audioFile,
  setAudioFile,
  transcriptionText = "",
  setTranscriptionText,
  transcriptionStatus = "idle",
  onTranscribe,
  useTranscription = false,
  setUseTranscription,
  useTranscriptionForSummary = false,
  setUseTranscriptionForSummary,
  mode,
}: Props) {
  const theme = useTheme();

  const durationInfo =
    videoDuration !== null &&
      Number.isFinite(videoDuration) &&
      videoDuration > 0
      ? { seconds: videoDuration }
      : null;
  const showTranscriptionUpload = Boolean(showAudioUpload && setAudioFile);
  const gridColsMd =
    supportsMediaUpload || showTranscriptionUpload
      ? "md:grid-cols-2"
      : "md:grid-cols-1";
  const isTranscriptionMode = mode === "transcription";

  const estimateTokens = (): string | null => {
    if (!durationInfo) return null;
    const { seconds } = durationInfo;
    const isAudioFile = mediaFile?.type.startsWith("audio/");
    const rate =
      isAudioFile || useAudioOnly
        ? AUDIO_TOKENS_PER_SEC
        : mediaResolution === "low"
          ? VIDEO_TOKENS_PER_SEC_LOW
          : VIDEO_TOKENS_PER_SEC_DEFAULT;
    const est = Math.round(seconds * rate);
    const modeLabel = isAudioFile
      ? "audio file"
      : useAudioOnly
        ? "audio-only"
        : `${mediaResolution} video`;
    return `Est. tokens: ~${est.toLocaleString()} (${modeLabel})`;
  };
  const isLocked = locked;
  const videoProgress =
    videoUploadState === "ready" || videoUploadState === "error"
      ? 100
      : videoUploadState === "uploading"
        ? 70
        : 0;

  return (
    <SectionCard
      title="Files"
      subtitle="Upload subtitles (required) and optional context media to improve summaries."
    >
      <div className={`grid grid-cols-1 gap-4 ${gridColsMd}`}>
        {/* Subtitle File Upload */}
        <FilePicker
          label={isTranscriptionMode ? "Subtitles (optional)" : "Subtitles (VTT or SRT, required)"}
          description={
            isTranscriptionMode
              ? "Optional: provide subtitles to compare against transcription"
              : "Click or drop your subtitle file"
          }
          accept=".vtt,.srt,text/vtt,text/srt"
          onChange={(e) => setVttFile(e.target.files?.[0] || null)}
          required={!isTranscriptionMode && !useTranscription} // Not required if using transcription
          fileName={vttFile?.name || null}
          fileMeta={
            vttFile ? `${(vttFile.size / 1024 / 1024).toFixed(2)} MB` : null
          }
          disabled={isLocked || useTranscription}
        />

        {/* Audio/Media File Upload (for Transcription) */}
        {supportsMediaUpload && (
          <FilePicker
            label={isTranscriptionMode ? "Media to Transcribe (required)" : "Context media (optional)"}
            description={
              isTranscriptionMode
                ? skipProviderUpload
                  ? "Select video or audio for Gemini inline transcription (no provider upload)"
                  : "Upload video or audio for Gemini transcription"
                : "Video or audio, used only for summary (keep small to reduce tokens)"
            }
            accept="video/mp4,video/*,audio/*"
            onChange={(e) => void setMediaFile(e.target.files?.[0] || null)}
            fileName={mediaFile?.name || null}
            fileMeta={
              mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB` : null
            }
            required={isTranscriptionMode}
            disabled={isLocked}
          />
        )}

        {/* Audio upload for OpenAI transcription (no provider upload) */}
        {showTranscriptionUpload && (
          <FilePicker
            label="Audio to Transcribe (required)"
            description="Upload audio for OpenAI transcription. Processed client-side and sent to OpenAI."
            accept="audio/*,video/mp4,video/*"
            onChange={(e) => void setAudioFile?.(e.target.files?.[0] || null)}
            fileName={audioFile?.name || null}
            fileMeta={
              audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : null
            }
            required={isTranscriptionMode}
            disabled={isLocked}
          />
        )}

      </div>

      {/* Transcription Controls */}
      {showAudioUpload && audioFile && onTranscribe && (
        <div className="space-y-3 pt-4 border-t" style={{ borderColor: theme.borderColor }}>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              tone="primary"
              onClick={onTranscribe}
              disabled={transcriptionStatus === "loading" || isLocked}
            >
              {transcriptionStatus === "loading" ? "Transcribing..." : "Transcribe Audio"}
            </Button>
            {transcriptionStatus === "success" && (
              <span className={`text-sm ${theme.successText}`}>Transcription complete!</span>
            )}
            {transcriptionStatus === "error" && (
              <span className={`text-sm ${theme.dangerText}`}>Transcription failed</span>
            )}
          </div>

          {/* Transcription Preview */}
          {(transcriptionText || transcriptionStatus === "success") && setTranscriptionText && setUseTranscription && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={useTranscription}
                      onChange={(e) => setUseTranscription(e.target.checked)}
                      disabled={isLocked}
                    />
                    <span>Use transcription as subtitles</span>
                  </label>
                  {setUseTranscriptionForSummary && (
                    <label className="inline-flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={useTranscriptionForSummary}
                        onChange={(e) => setUseTranscriptionForSummary(e.target.checked)}
                        disabled={isLocked}
                      />
                      <span>Use transcription for summary</span>
                    </label>
                  )}
                </div>
              </div>

              <TextArea
                value={transcriptionText}
                onChange={(e) => setTranscriptionText(e.target.value)}
                placeholder="Transcription output will appear here..."
                rows={6}
                variant="code"
                disabled={isLocked}
              />
            </div>
          )}
        </div>
      )}

      {supportsMediaUpload && (
        <>
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useAudioOnly}
                onChange={(e) => setUseAudioOnly(e.target.checked)}
                disabled={isLocked}
                title="Extract mono audio from video before upload to reduce size and token cost."
              />
              <span>
                Upload audio-only (smaller upload; recommended for free tier)
              </span>
            </label>
            <p className={theme.helperText}>
              {isTranscriptionMode
                ? "For transcription, audio-only reduces upload size and improves speed."
                : "Media is only used to generate the optional summary; translation uses the text + summary."}
            </p>
          </div>

          {!skipProviderUpload ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  tone="upload"
                  onClick={handleUploadVideo}
                  disabled={
                    !mediaFile ||
                    !apiKey ||
                    submitting ||
                    videoUploadState === "uploading"
                  }
                >
                  {videoUploadState === "uploading"
                    ? LABELS.uploadMediaUploading
                    : LABELS.uploadMedia}
                </Button>
                {videoRef && videoUploadState === "ready" && (
                  <span className={`text-xs ${theme.successText}`}>Ready</span>
                )}
                {videoRef && (
                  <Button
                    type="button"
                    tone="danger"
                    onClick={handleDeleteVideo}
                    disabled={submitting || videoUploadState === "uploading"}
                  >
                    Delete uploaded media
                  </Button>
                )}
              </div>
              <div className={`h-2 rounded overflow-hidden ${theme.progressTrack}`}>
                <div
                  className={`h-2 ${videoUploadState === "error" ? theme.progressError : videoUploadState === "ready" ? theme.progressOk : theme.progressBar} ${videoUploadState === "uploading" ? "animate-pulse" : ""}`}
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
              <p className={theme.helperText}>
                {videoUploadMessage || "Upload to verify Gemini processed the video."}
              </p>
              {mediaTooLargeWarning && (
                <p className={`${theme.warningText} text-xs`}>
                  Selected media exceeds the 2&nbsp;GB Gemini/ffmpeg limit and cannot
                  be uploaded.
                </p>
              )}
              {mediaFile && (
                <div className={`${theme.helperText} space-y-1`}>
                  <p>
                    Size:{" "}
                    {videoSizeMb !== null ? `${videoSizeMb.toFixed(2)} MB` : "n/a"}
                  </p>
                  <p>
                    Duration:{" "}
                    {durationInfo ? formatDuration(durationInfo.seconds) : "n/a"}
                  </p>
                  <p>{estimateTokens() ?? "Est. tokens: n/a"}</p>
                </div>
              )}
            </div>
          ) : (
            mediaFile && (
              <div className={`${theme.helperText} space-y-1`}>
                <p>
                  Size: {videoSizeMb !== null ? `${videoSizeMb.toFixed(2)} MB` : "n/a"}
                </p>
                <p>Duration: {durationInfo ? formatDuration(durationInfo.seconds) : "n/a"}</p>
                <p>{estimateTokens() ?? "Est. tokens: n/a"}</p>
              </div>
            )
          )}
        </>
      )}
    </SectionCard>
  );
}
