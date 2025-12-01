import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  DEFAULT_CHUNK_SECONDS,
  DEFAULT_CONCURRENCY,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_MODEL,
  DEFAULT_MODELS,
  DEFAULT_OVERLAP_CUES,
  DEFAULT_SOURCE_LANG,
  DEFAULT_STYLE,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_TARGET_LANG,
  DEFAULT_TEMPERATURE,
  DEFAULT_USE_AUDIO_ONLY,
  DEFAULT_USE_GLOSSARY,
  DEFAULT_USE_SUMMARY,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  MAX_CONCURRENCY,
  PROMPT_PRESETS,
  type PromptPresetId,
} from '../config/defaults'
import { deleteUploadedFile, listModels, translateChunkText, uploadContextVideo } from '../lib/gemini'
import { extractAudioToOggMono } from '../lib/ffmpeg'
import { type ChunkStatus } from '../lib/translation'
import { buildUserPrompt } from '../lib/prompts'
import { parseSrt, parseVtt } from '../lib/vtt'
import { useTranslationRunner } from './useTranslationRunner'
import { getMediaDuration } from '../lib/mediaDuration'

import { clearPrefs, loadPrefs, savePrefs, type UserPrefs } from '../lib/prefs'
import { type CustomPreset, importPresets, downloadPresetFile, createPresetFromCurrent } from '../lib/presetImportExport'

export function useTranslationWorkflowRunner() {
  const saved = loadPrefs()
  const mediaProbeIdRef = useRef(0)
  const [vttFile, setVttFile] = useState<File | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [useAudioOnly, setUseAudioOnly] = useState(saved?.useAudioOnly ?? DEFAULT_USE_AUDIO_ONLY)
  const [sourceLang, setSourceLang] = useState(saved?.sourceLang ?? DEFAULT_SOURCE_LANG)
  const [targetLang, setTargetLang] = useState(saved?.targetLang ?? DEFAULT_TARGET_LANG)
  const [style, setStyle] = useState<string>(saved?.style ?? DEFAULT_STYLE)
  const [concurrency, setConcurrency] = useState<number>(saved?.concurrency ?? DEFAULT_CONCURRENCY)
  const [chunkSeconds, setChunkSeconds] = useState<number>(saved?.chunkSeconds ?? DEFAULT_CHUNK_SECONDS)
  const [chunkOverlap, setChunkOverlap] = useState<number>(saved?.chunkOverlap ?? DEFAULT_OVERLAP_CUES)
  const [models, setModels] = useState<string[]>(saved?.models && saved.models.length ? saved.models : DEFAULT_MODELS)
  const [modelName, setModelName] = useState(saved?.modelName ?? DEFAULT_MODEL)
  const [customPrompt, setCustomPrompt] = useState(saved?.customPrompt ?? DEFAULT_SYSTEM_PROMPT_TEXT)
  const [glossary, setGlossary] = useState(saved?.glossary ?? '')
  const [useGlossary, setUseGlossary] = useState(saved?.useGlossary ?? DEFAULT_USE_GLOSSARY)
  const [apiKey, setApiKey] = useState('')
  const [videoName, setVideoName] = useState<string | null>(null)
  const [videoRef, setVideoRef] = useState<string | null>(null)
  const [videoFileId, setVideoFileId] = useState<string | null>(null)
  const [contextMediaKind, setContextMediaKind] = useState<'audio' | 'video' | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoSizeMb, setVideoSizeMb] = useState<number | null>(null)
  const [videoUploadState, setVideoUploadState] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle')
  const [videoUploadMessage, setVideoUploadMessage] = useState('')
  const [mediaTooLargeWarning, setMediaTooLargeWarning] = useState(false)
  const [temperature, setTemperature] = useState(saved?.temperature ?? DEFAULT_TEMPERATURE)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summaryText, setSummaryText] = useState(saved?.summaryText ?? '')
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [summaryError, setSummaryError] = useState('')
  const [glossaryStatus, setGlossaryStatus] = useState<'idle' | 'loading'>('idle')
  const [glossaryError, setGlossaryError] = useState('')
  const [summaryPrompt, setSummaryPrompt] = useState(saved?.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT)
  const [useSummary, setUseSummary] = useState(saved?.useSummary ?? DEFAULT_USE_SUMMARY)
  const [glossaryPrompt, setGlossaryPrompt] = useState(saved?.glossaryPrompt ?? DEFAULT_GLOSSARY_PROMPT)
  const [safetyOff, setSafetyOff] = useState(saved?.safetyOff ?? false)
  const [mediaResolution, setMediaResolution] = useState<'low' | 'standard'>(saved?.mediaResolution ?? 'low')
  const [currentPreset, setCurrentPreset] = useState<PromptPresetId | ''>('general')

  // Custom presets stored in localStorage
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      const stored = window.localStorage.getItem('customPresets')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const { state: runnerState, actions: runnerActions } = useTranslationRunner()

  // Save custom presets to localStorage whenever they change
  useEffect(() => {
    try {
      window.localStorage.setItem('customPresets', JSON.stringify(customPresets))
    } catch {
      // ignore storage errors
    }
  }, [customPresets])

  const clampConcurrency = (value: number) => Math.min(MAX_CONCURRENCY, Math.max(1, value))
  const setConcurrencyClamped = (value: number) => setConcurrency(clampConcurrency(value))
  const normalizeCustomPrompt = (value: string) => {
    const trimmed = value.trim()
    return trimmed && trimmed === DEFAULT_SYSTEM_PROMPT_TEXT.trim() ? '' : trimmed
  }

  useEffect(() => {
    const prefs: UserPrefs = {
      modelName,
      models,
      mediaResolution,
      useAudioOnly,
      sourceLang,
      targetLang,
      style,
      chunkSeconds,
      chunkOverlap,
      concurrency,
      temperature,
      customPrompt,
      glossary,
      summaryText,
      summaryPrompt,
      glossaryPrompt,
      useSummary,
      useGlossary,
      safetyOff,
    }
    savePrefs(prefs)
  }, [
    modelName,
    models,
    mediaResolution,
    useAudioOnly,
    sourceLang,
    targetLang,
    style,
    chunkSeconds,
    chunkOverlap,
    concurrency,
    temperature,
    customPrompt,
    glossary,
    summaryText,
    summaryPrompt,
    glossaryPrompt,
    useSummary,
    useGlossary,
    safetyOff,
  ])

  const handleMediaChange = async (file: File | null) => {
    const probeId = ++mediaProbeIdRef.current
    const maxUploadBytes = 2 * 1024 * 1024 * 1024 // 2GB limit for Gemini File API and ffmpeg wasm practicality
    if (file && file.size > maxUploadBytes) {
      setMediaFile(null)
      setVideoUploadState('error')
      setVideoUploadMessage('File exceeds 2GB limit (Gemini File API + in-browser processing). Please trim or compress.')
      setVideoName(null)
      setVideoFileId(null)
      setVideoDuration(null)
      setVideoSizeMb(null)
      setMediaTooLargeWarning(true)
      setUseSummary(false)
      setSummaryText('')
      setSummaryStatus('idle')
      setSummaryError('')
      return
    }

    setMediaFile(file)
    setVideoRef(null)
    setVideoUploadState('idle')
    setVideoUploadMessage('')
    setMediaTooLargeWarning(false)
    setVideoName(null)
    setVideoFileId(null)
    setVideoDuration(null)
    setVideoSizeMb(null)
    setUseSummary(false)
    setSummaryText('')
    setSummaryStatus('idle')
    setSummaryError('')
    if (file) {
      setVideoSizeMb(file.size / (1024 * 1024))
      try {
        const duration = await getMediaDuration(file)
        if (mediaProbeIdRef.current === probeId) {
          setVideoDuration(duration && Number.isFinite(duration) ? duration : null)
        }
      } catch (err) {
        setVideoUploadMessage(err instanceof Error ? err.message : 'Unable to read video duration')
      }
    }
  }

  const handleUploadVideo = async () => {
    if (!mediaFile) {
      setError('Select a context media file to upload')
      return
    }
    if (!apiKey) {
      setError('Gemini API key is required to upload video')
      return
    }
    setError('')
    setVideoUploadState('uploading')
    setVideoUploadMessage('Uploading media to Gemini…')
    try {
      let mediaToUpload: File = mediaFile
      const isAudio = mediaToUpload.type.startsWith('audio/')
      if (useAudioOnly && !isAudio) {
        const audio = await extractAudioToOggMono(mediaFile)
        mediaToUpload = audio
        setVideoName(audio.name)
        setVideoSizeMb(audio.size / (1024 * 1024))
        const probeId = ++mediaProbeIdRef.current
        const duration = await getMediaDuration(audio)
        if (mediaProbeIdRef.current === probeId) {
          setVideoDuration(duration && Number.isFinite(duration) ? duration : null)
        }
      }
      const data = await uploadContextVideo(mediaToUpload, apiKey)
      setVideoRef(data.fileUri)
      setVideoName((prev) => prev || data.fileName || mediaToUpload.name || null)
      setVideoFileId(data.fileName || null)
      setContextMediaKind((useAudioOnly || isAudio) ? 'audio' : 'video')
      setVideoUploadState('ready')
      setVideoUploadMessage('Media is uploaded, processed, and ready.')
      runnerActions.setProgress('')
      setUseSummary(false)
      setSummaryText('')
      setSummaryStatus('idle')
      setSummaryError('')
    } catch (err) {
      setVideoUploadState('error')
      setVideoUploadMessage(err instanceof Error ? err.message : 'Unable to upload video')
    }
  }

  const handleDeleteVideo = async () => {
    if (!videoRef || !apiKey) {
      setError('No uploaded media to delete or missing API key')
      return
    }
    const target = videoFileId || (videoRef.includes('/files/') ? videoRef.split('/files/').pop() : null)
    if (!target) {
      setError('Could not determine uploaded media name to delete')
      return
    }
    runnerActions.setProgress('Deleting uploaded video from Gemini…')
    setError('')
    try {
      await deleteUploadedFile(target, apiKey)
      setVideoRef(null)
      setVideoName(null)
      setVideoFileId(null)
      setContextMediaKind(null)
      setVideoUploadState('idle')
      setVideoUploadMessage('Deleted from Gemini')
      runnerActions.setProgress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete uploaded video')
      runnerActions.setProgress('')
    }
  }

  const handleLoadModels = async () => {
    if (!apiKey) {
      setError('Gemini API key is required to load models')
      return
    }
    setError('')
    runnerActions.setProgress('Loading models…')
    try {
      const names = await listModels(apiKey)
      if (names.length > 0) {
        setModels(names)
        setModelName(names[0])
      }
      runnerActions.setProgress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load models')
      runnerActions.setProgress('')
    }
  }

  const handleGenerateGlossary = async () => {
    if (!vttFile) {
      setGlossaryError('Load subtitles first to generate glossary')
      return
    }
    setGlossaryStatus('loading')
    try {
      const text = await vttFile.text()
      let cues: ReturnType<typeof parseVtt>
      try {
        cues = vttFile.name.toLowerCase().endsWith('.srt') ? parseSrt(text) : parseVtt(text)
      } catch {
        cues = parseSrt(text)
      }
      const rawText = cues.map((c) => `${c.text}`).join('\n')
      const truncated = rawText.slice(0, 8000)
      if (apiKey) {
        const systemPrompt = glossaryPrompt.trim() || DEFAULT_GLOSSARY_PROMPT
        const userPrompt =
          'Generate a glossary for these subtitles. Output ONLY CSV lines: source,target. Focus on recurring names/terms that should stay consistent. Text follows:\n\n' +
          truncated
        const generated = await translateChunkText({
          apiKey,
          modelName,
          systemPrompt,
          userPrompt,
          temperature: DEFAULT_TEMPERATURE,
          safetyOff,
          trace: { purpose: 'glossary' },
        })
        const text = generated.text.trim()
        setGlossary(text)
        setUseGlossary(!!text)
      } else {
        const counts = new Map<string, number>()
        for (const cue of cues) {
          const tokens = cue.text
            .replace(/\d+:\d+:\d+\.\d+/g, ' ')
            .split(/[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fffー]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 1)
          tokens.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
        }
        const top = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([term]) => `${term},`)
          .join('\n')
        setGlossary(top)
        setUseGlossary(!!top.trim())
      }
      setGlossaryError('')
    } catch (err) {
      setGlossaryError(err instanceof Error ? err.message : 'Failed to generate glossary')
    } finally {
      setGlossaryStatus('idle')
    }
  }

  const handleGenerateSummary = async () => {
    if (!apiKey) {
      setSummaryError('Gemini API key required to generate summary')
      return
    }
    if (!videoRef) {
      setSummaryError('Upload media first to generate a summary')
      return
    }
    setSummaryError('')
    setSummaryStatus('loading')
    try {
      const systemPrompt = summaryPrompt.trim() || DEFAULT_SUMMARY_PROMPT
      const userPrompt =
        'Use the attached media to produce a sectioned bullet summary as instructed. Respond ONLY with bullets grouped by section labels.'
      const resolution = contextMediaKind === 'video' ? mediaResolution : undefined
      const summary = await translateChunkText({
        apiKey,
        modelName,
        systemPrompt,
        userPrompt,
        videoUri: videoRef,
        temperature: DEFAULT_TEMPERATURE,
        safetyOff,
        trace: { purpose: 'summary' },
        mediaResolution: resolution,
      })
      const text = summary.text.trim()
      setSummaryText(text)
      setUseSummary(!!text)
      setSummaryStatus('ready')
      setSummaryError('')
    } catch (err) {
      setSummaryStatus('error')
      setSummaryError(err instanceof Error ? err.message : 'Summary generation failed')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    runnerActions.setResult(null)
    runnerActions.setProgress('')
    if (!vttFile) {
      setError('Subtitle file is required')
      return
    }
    if (!apiKey) {
      setError('Gemini API key is required')
      return
    }

    setSubmitting(true)
    runnerActions.setProgress('Reading subtitles…')

    let vttText = ''
    try {
      vttText = await vttFile.text()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read VTT file')
      setSubmitting(false)
      return
    }

    let cues: ReturnType<typeof parseVtt>
    const lowerName = vttFile.name.toLowerCase()
    try {
      if (lowerName.endsWith('.srt')) {
        cues = parseSrt(vttText)
      } else {
        try {
          cues = parseVtt(vttText)
        } catch {
          cues = parseSrt(vttText)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid VTT or SRT file')
      setSubmitting(false)
      return
    }

    const activeVideoRef = videoRef
    const combinedPrompt = normalizeCustomPrompt(customPrompt)
    try {
      const data = await runnerActions.runTranslation({
        cues,
        chunkSeconds,
        chunkOverlap,
        apiKey,
        modelName,
        sourceLang,
        targetLang,
        style,
        glossary,
        useGlossary,
        customPrompt: combinedPrompt,
        concurrency,
        temperature,
        useSummary,
        summaryText,
        videoRef: activeVideoRef,
        safetyOff,
      })
      if (!data) {
        setSubmitting(false)
        return
      }
      if (data.video_ref) {
        setVideoRef(data.video_ref)
        setVideoUploadState('ready')
        setVideoUploadMessage('Video already uploaded and ready for retries.')
      } else if (activeVideoRef) {
        setVideoUploadState('ready')
        setVideoUploadMessage('Video already uploaded and ready for retries.')
      }
      runnerActions.setProgress('Stitching complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error during translation')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetryChunk = async (chunk: ChunkStatus) => {
    if (!apiKey || !runnerState.result) {
      setError('Gemini API key required to retry')
      return
    }
    if (!chunk.chunk_vtt) {
      setError('No chunk payload available to retry')
      return
    }
    runnerActions
      .retryChunk({
        chunk,
        apiKey,
        modelName,
        sourceLang,
        targetLang,
        style,
        glossary,
        useGlossary,
        customPrompt: normalizeCustomPrompt(customPrompt) || '',
        temperature,
        useSummary,
        summaryText,
        safetyOff,
        concurrency,
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Retry error'))
  }

  const resetWorkflow = () => {
    // Reset run state only; keep user-configured options and text fields.
    setError('')
    setSubmitting(false)
    runnerActions.reset()
  }

  const clearPreferences = () => {
    // Reset non-sensitive preferences to defaults; keep files and API key intact.
    setModels(DEFAULT_MODELS)
    setModelName(DEFAULT_MODEL)
    setMediaResolution('low')
    setUseAudioOnly(DEFAULT_USE_AUDIO_ONLY)
    setSourceLang(DEFAULT_SOURCE_LANG)
    setTargetLang(DEFAULT_TARGET_LANG)
    setStyle(DEFAULT_STYLE)
    setChunkSeconds(DEFAULT_CHUNK_SECONDS)
    setChunkOverlap(DEFAULT_OVERLAP_CUES)
    setConcurrencyClamped(DEFAULT_CONCURRENCY)
    setTemperature(DEFAULT_TEMPERATURE)
    setCustomPrompt(DEFAULT_SYSTEM_PROMPT_TEXT)
    // Keep user-entered summary/glossary content
    setSummaryPrompt(DEFAULT_SUMMARY_PROMPT)
    setGlossaryPrompt(DEFAULT_GLOSSARY_PROMPT)
    setUseSummary(DEFAULT_USE_SUMMARY)
    setUseGlossary(DEFAULT_USE_GLOSSARY)
    setSafetyOff(false)
    try {
      clearPrefs()
      window.localStorage.removeItem('theme')
    } catch {
      // ignore storage errors
    }
  }

  const promptPreview = useMemo(() => {
    return buildUserPrompt(
      sourceLang,
      targetLang,
      style,
      glossary,
      chunkOverlap > 0 ? '(Previous chunk context will appear here...)' : '',
      '(Subtitle cues to translate will appear here...)',
      useSummary && summaryText ? summaryText : undefined,
      useGlossary,
    )
  }, [sourceLang, targetLang, style, glossary, useSummary, summaryText, useGlossary, chunkOverlap])

  const applyPreset = (presetId: PromptPresetId) => {
    const preset = PROMPT_PRESETS[presetId]
    if (!preset) return
    setCustomPrompt(preset.systemText)
    setSummaryPrompt(preset.summary)
    setGlossaryPrompt(preset.glossary)
    setCurrentPreset(presetId)
  }

  const applyCustomPreset = (preset: CustomPreset) => {
    setCustomPrompt(preset.systemText)
    setSummaryPrompt(preset.summary)
    setGlossaryPrompt(preset.glossary)
    setCurrentPreset(preset.id as PromptPresetId)
  }

  const exportCurrentAsPreset = (name: string, description?: string) => {
    const id = `custom-${Date.now()}`
    const preset = createPresetFromCurrent(
      id,
      name,
      customPrompt,
      customPrompt, // Using same for video (could be enhanced later)
      customPrompt, // Using same for audio (could be enhanced later)
      summaryPrompt,
      glossaryPrompt,
      description
    )
    downloadPresetFile([preset], `${name.toLowerCase().replace(/\s+/g, '-')}.json`)
  }

  const importPresetsFromJson = (jsonString: string) => {
    try {
      const imported = importPresets(jsonString)
      setCustomPresets(prev => {
        // Merge, avoiding duplicates by ID
        const existingIds = new Set(prev.map(p => p.id))
        const newPresets = imported.filter(p => !existingIds.has(p.id))
        return [...prev, ...newPresets]
      })
      return { success: true, count: imported.length }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Import failed' }
    }
  }

  const deleteCustomPreset = (id: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== id))
    if (currentPreset === id) {
      setCurrentPreset('general')
    }
  }

  const exportAllCustomPresets = () => {
    if (customPresets.length === 0) return
    downloadPresetFile(customPresets, 'chigyusubs-custom-presets.json')
  }

  // Merge built-in and custom presets for display
  const allPresets = useMemo(() => {
    const builtIn = Object.entries(PROMPT_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
      isBuiltIn: true,
    }))
    const custom = customPresets.map(p => ({
      id: p.id,
      name: p.name,
      isBuiltIn: false,
    }))
    return [...builtIn, ...custom]
  }, [customPresets])

  return {
    state: {
      vttFile,
      mediaFile,
      useAudioOnly,
      sourceLang,
      targetLang,
      style,
      concurrency,
      chunkSeconds,
      chunkOverlap,
      models,
      modelName,
      customPrompt,
      glossary,
      useGlossary,
      apiKey,
      videoName,
      videoRef,
      videoUploadState,
      videoUploadMessage,
      mediaTooLargeWarning,
      videoSizeMb,
      videoDuration,
      temperature,
      progress: runnerState.progress,
      result: runnerState.result,
      paused: runnerState.paused,
      isRunning: runnerState.isRunning,
      error,
      submitting,
      retryingChunks: runnerState.retryingChunks,
      retryQueueIds: runnerState.retryQueueIds,
      summaryText,
      summaryStatus,
      summaryError,
      glossaryStatus,
      glossaryError,
      summaryPrompt,
      useSummary,
      glossaryPrompt,
      promptPreview,
      safetyOff,
      mediaResolution,
      currentPreset,
      customPresets,
      allPresets,
    },
    actions: {
      setVttFile,
      setMediaFile: handleMediaChange,
      setUseAudioOnly,
      setSourceLang,
      setTargetLang,
      setStyle,
      setConcurrency: setConcurrencyClamped,
      setChunkSeconds,
      setChunkOverlap,
      setModelName,
      setCustomPrompt,
      setGlossary,
      setUseGlossary,
      setApiKey,
      setTemperature,
      setSummaryPrompt,
      setUseSummary,
      setGlossaryPrompt,
      setSafetyOff,
      setMediaResolution,
      handleLoadModels,
      handleUploadVideo,
      handleDeleteVideo,
      handleGenerateGlossary,
      handleGenerateSummary,
      setSummaryText,
      handleSubmit,
      handleRetryChunk,
      resetWorkflow,
      pause: runnerActions.pause,
      resume: runnerActions.resume,
      clearPreferences,
      applyPreset,
      applyCustomPreset,
      exportCurrentAsPreset,
      importPresetsFromJson,
      deleteCustomPreset,
      exportAllCustomPresets,
    },
  }
}
