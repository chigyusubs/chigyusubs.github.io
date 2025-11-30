import React from 'react'
import { LABELS } from '../config/ui'
import { useTheme } from '../lib/themeContext'
import { AUDIO_TOKENS_PER_SEC, VIDEO_TOKENS_PER_SEC_DEFAULT, VIDEO_TOKENS_PER_SEC_LOW } from '../config/defaults'
import { Button } from './ui/Button'
import { SectionCard } from './ui/SectionCard'
import { FilePicker } from './ui/Field'
import { Spinner } from './Spinner'

type Props = {
    vttFile: File | null
    setVttFile: (file: File | null) => void
    mediaFile: File | null
    setMediaFile: (file: File | null) => void
    useAudioOnly: boolean
    setUseAudioOnly: (use: boolean) => void
    videoRef: string | null
    videoUploadState: 'idle' | 'uploading' | 'ready' | 'error'
  videoUploadMessage: string
  videoSizeMb: number | null
  videoDuration: number | null
  mediaResolution: 'low' | 'standard'
  handleUploadVideo: () => void
  handleDeleteVideo: () => void
  submitting: boolean
  apiKey: string
  locked: boolean
}

function formatDuration(seconds: number | null): string {
    if (!seconds || Number.isNaN(seconds)) return 'n/a'
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
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
}: Props) {
  const theme = useTheme()
  const estimateTokens = (): string | null => {
    if (!videoDuration || Number.isNaN(videoDuration)) return null
    const rate = useAudioOnly
      ? AUDIO_TOKENS_PER_SEC
      : mediaResolution === 'low'
        ? VIDEO_TOKENS_PER_SEC_LOW
        : VIDEO_TOKENS_PER_SEC_DEFAULT
    const est = Math.round(videoDuration * rate)
    return `Est. tokens: ~${est.toLocaleString()} (${useAudioOnly ? 'audio-only' : `${mediaResolution} video`})`
  }
  const isLocked = locked
  const videoProgress =
        videoUploadState === 'ready' || videoUploadState === 'error'
            ? 100
            : videoUploadState === 'uploading'
                ? 70
                : 0

  return (
        <SectionCard
            title="Files"
            subtitle="Upload subtitles (required) and optional context media to improve summaries."
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FilePicker
                    label="Subtitles (VTT or SRT, required)"
                    description="Click or drop your subtitle file"
                    accept=".vtt,.srt,text/vtt,text/srt"
                    onChange={(e) => setVttFile(e.target.files?.[0] || null)}
                    required
                    fileName={vttFile?.name || null}
                    fileMeta={vttFile ? `${(vttFile.size / 1024 / 1024).toFixed(2)} MB` : null}
                    disabled={isLocked}
                />
                <FilePicker
                    label="Context media (optional)"
                    description="Video or audio, used only for summary (keep small to reduce tokens)"
                    accept="video/mp4,video/*,audio/*"
                    onChange={(e) => void setMediaFile(e.target.files?.[0] || null)}
                    fileName={mediaFile?.name || null}
                    fileMeta={mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB` : null}
                    disabled={isLocked}
                />
            </div>

            <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={useAudioOnly}
                        onChange={(e) => setUseAudioOnly(e.target.checked)}
                        disabled={isLocked}
                        title="Extract mono audio from video before upload to reduce size and token cost."
                    />
                    <span>Upload audio-only (smaller upload; recommended for free tier)</span>
                </label>
                <p className={theme.helperText}>
                    Media is only used to generate the optional summary; translation uses the text + summary.
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        tone="upload"
                        onClick={handleUploadVideo}
                        disabled={!mediaFile || !apiKey || submitting || videoUploadState === 'uploading'}
                    >
                        {videoUploadState === 'uploading' && <Spinner />}
                        {videoUploadState === 'uploading' ? LABELS.uploadMediaUploading : LABELS.uploadMedia}
                    </Button>
                    {videoRef && videoUploadState === 'ready' && (
                        <span className={`text-xs ${theme.successText}`}>Ready</span>
                    )}
                    {videoRef && (
                        <Button
                            type="button"
                            tone="danger"
                            onClick={handleDeleteVideo}
                            disabled={submitting || videoUploadState === 'uploading'}
                        >
                            Delete uploaded media
                        </Button>
                    )}
                </div>
                <div className={`h-2 rounded overflow-hidden ${theme.progressTrack}`}>
                    <div
                        className={`h-2 ${videoUploadState === 'error' ? theme.progressError : videoUploadState === 'ready' ? theme.progressOk : theme.progressBar} ${videoUploadState === 'uploading' ? 'animate-pulse' : ''}`}
                        style={{ width: `${videoProgress}%` }}
                    />
                </div>
                <p className={theme.helperText}>
                    {videoUploadMessage || 'Upload to verify Gemini processed the video.'}
                </p>
                {(videoSizeMb !== null || videoDuration !== null || estimateTokens()) && (
                    <div className={`${theme.helperText} space-y-1`}>
                        {videoSizeMb !== null && <p>Size: {videoSizeMb.toFixed(2)} MB</p>}
                        {videoDuration !== null && <p>Duration: {formatDuration(videoDuration)}</p>}
                        {estimateTokens() && <p>{estimateTokens()}</p>}
                    </div>
                )}
            </div>
        </SectionCard>
    )
}
