import { useState } from 'react'

export function useFileState() {
  const [vttFile, setVttFile] = useState<File | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [useAudioOnly, setUseAudioOnly] = useState(true)
  const [videoName, setVideoName] = useState<string | null>(null)
  const [videoRef, setVideoRef] = useState<string | null>(null)
  const [videoFileId, setVideoFileId] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<'audio' | 'video' | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoSizeMb, setVideoSizeMb] = useState<number | null>(null)
  const [videoUploadState, setVideoUploadState] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle')
  const [videoUploadMessage, setVideoUploadMessage] = useState('')

  return {
    state: {
      vttFile,
      mediaFile,
      useAudioOnly,
      videoName,
      videoRef,
      videoFileId,
      mediaKind,
      videoDuration,
      videoSizeMb,
      videoUploadState,
      videoUploadMessage,
    },
    actions: {
      setVttFile,
      setMediaFile,
      setUseAudioOnly,
      setVideoName,
      setVideoRef,
      setVideoFileId,
      setMediaKind,
      setVideoDuration,
      setVideoSizeMb,
      setVideoUploadState,
      setVideoUploadMessage,
    },
  }
}
