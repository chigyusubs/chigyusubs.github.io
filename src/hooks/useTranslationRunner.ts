import { useRef, useState } from 'react'
import { chunkCues } from '../lib/chunker'
import { deriveSrt, stitchVtt } from '../lib/stitcher'
import { translateChunkFromText, translateCues, type ChunkStatus, type TranslateResult } from '../lib/translation'
import { serializeVtt, type Cue } from '../lib/vtt'
import { logDebugEvent } from '../lib/debugState'
import { isDebugEnabled } from '../lib/debugToggle'

export type RunnerProgress = {
  progress: string
  result: TranslateResult | null
  retryingChunks: number[]
  retryQueueIds: number[]
  paused: boolean
  isRunning: boolean
}

type RunOptions = {
  cues: Cue[]
  chunkSeconds: number
  chunkOverlap: number
  apiKey: string
  modelName: string
  sourceLang: string
  targetLang: string
  style: string
  glossary: string
  useGlossary: boolean
  customPrompt: string
  concurrency: number
  temperature: number
  useSummary: boolean
  summaryText: string
  videoRef: string | null
  safetyOff: boolean
}

type RetryOptions = {
  chunk: ChunkStatus
  apiKey: string
  modelName: string
  sourceLang: string
  targetLang: string
  style: string
  glossary: string
  useGlossary: boolean
  customPrompt: string
  temperature: number
  useSummary: boolean
  summaryText: string
  safetyOff: boolean
  concurrency: number
  runToken?: number
}

export function useTranslationRunner() {
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [retryingChunks, setRetryingChunks] = useState<number[]>([])
  const retryQueueRef = useRef<RetryOptions[]>([])
  const retryingRef = useRef(false)
  const [retryQueueIds, setRetryQueueIds] = useState<number[]>([])
  const enqueuedRetryIds = useRef<Set<number>>(new Set())
  const concurrencyRef = useRef<number>(1)
  const activeRetriesRef = useRef<number>(0)
  const retryingSetRef = useRef<Set<number>>(new Set())
  const chunkStatusRef = useRef<Map<number, ChunkStatus['status']>>(new Map())
  const processingCount = () => {
    let total = 0
    chunkStatusRef.current.forEach((status) => {
      if (status === 'processing') total += 1
    })
    return total
  }
  const autoPauseRef = useRef(false)
  const resultRef = useRef<TranslateResult | null>(null)
  const runTokenRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const reset = () => {
    runTokenRef.current += 1
    pausedRef.current = false
    setPaused(false)
    setIsRunning(false)
    concurrencyRef.current = 1
    activeRetriesRef.current = 0
    chunkStatusRef.current = new Map()
    resultRef.current = null
    autoPauseRef.current = false
    setProgress('')
    setResult(null)
    setRetryingChunks([])
    setRetryQueueIds([])
    retryQueueRef.current = []
    retryingRef.current = false
    enqueuedRetryIds.current = new Set()
    activeRetriesRef.current = 0
    retryingSetRef.current = new Set()
  }

  const runTranslation = async (opts: RunOptions) => {
    const runToken = ++runTokenRef.current
    pausedRef.current = false
    setPaused(false)
    concurrencyRef.current = Math.max(1, opts.concurrency || 1)
    retryQueueRef.current = []
    enqueuedRetryIds.current = new Set()
    retryingSetRef.current = new Set()
    retryingRef.current = false
    activeRetriesRef.current = 0
    chunkStatusRef.current = new Map()
    resultRef.current = null
    autoPauseRef.current = false
    const previewChunks = chunkCues(opts.cues, opts.chunkSeconds, opts.chunkOverlap)
    const totalChunks = previewChunks.length || 1
    if (isDebugEnabled()) {
      logDebugEvent({ kind: 'run-start', runId: runToken, data: { totalChunks, concurrency: concurrencyRef.current } })
    }

    const pending: ChunkStatus[] = previewChunks.map((chunk) => ({
      idx: chunk.idx,
      status: 'waiting',
      tokens_estimate: Math.max(Math.floor(serializeVtt(chunk.cues).length / 4), 1),
      warnings: [],
      vtt: '',
      raw_vtt: '',
      raw_model_output: '',
      chunk_vtt: serializeVtt(chunk.cues),
      context_vtt: chunk.prevContext.length ? serializeVtt(chunk.prevContext) : '',
      prompt: '',
      started_at: 0,
      finished_at: 0,
    }))

    if (runToken === runTokenRef.current) {
      setResult({ ok: false, warnings: [], chunks: pending, vtt: '', srt: '', video_ref: opts.videoRef })
      setProgress('Translating…')
      setIsRunning(true)
    }

    const data = await translateCues({
      cues: opts.cues,
      apiKey: opts.apiKey,
      modelName: opts.modelName,
      sourceLang: opts.sourceLang,
      targetLang: opts.targetLang,
      style: opts.style,
      glossary: opts.glossary,
      useGlossary: opts.useGlossary && opts.glossary.trim() ? true : false,
      customPrompt: opts.customPrompt,
      // Context video/audio is intentionally not passed here to avoid extra
      // generation cost/rate-limit hits; change to opts.videoRef if re-enabled.
      videoUri: undefined,
      videoLabel: null,
      mediaKind: undefined,
      concurrency: opts.concurrency,
      temperature: opts.temperature,
      targetSeconds: opts.chunkSeconds,
      overlap: opts.chunkOverlap,
      summaryText: opts.useSummary && opts.summaryText ? opts.summaryText.trim() : undefined,
      safetyOff: opts.safetyOff,
      shouldCancel: () => runToken !== runTokenRef.current,
      shouldPause: () => pausedRef.current || autoPauseRef.current,
      runId: runToken,
      onChunkUpdate: (chunkResult) => {
        if (runToken !== runTokenRef.current) return
        const prevStatus = chunkStatusRef.current.get(chunkResult.idx)
        if (chunkResult.status === 'processing' && prevStatus !== 'processing') {
          // processing count is derived; no counter needed
        } else if (prevStatus === 'processing' && chunkResult.status !== 'processing') {
          // processing count is derived; no counter needed
        }
        chunkStatusRef.current.set(chunkResult.idx, chunkResult.status)
        if (isDebugEnabled()) {
          logDebugEvent({
            kind: 'chunk-status',
            runId: runToken,
            chunkIdx: chunkResult.idx,
            data: { status: chunkResult.status, warnings: chunkResult.warnings?.length || 0 },
          })
        }
        let completedCount = 0
        let mergedCount = totalChunks
        const annotated = {
          ...chunkResult,
          model_name: opts.modelName,
          temperature: opts.temperature,
          duration_ms: chunkResult.finished_at - chunkResult.started_at,
        }
        setResult((prev) => {
          const existing = prev?.chunks || []
          const without = existing.filter((c) => c.idx !== annotated.idx)
          const merged = [...without, annotated].sort((a, b) => a.idx - b.idx)
          const okParts = merged.filter((c) => c.status === 'ok').map((c) => c.vtt || '')
          const stitchedVtt = okParts.length ? stitchVtt(okParts) : ''
          const warnings = merged.flatMap((c) => c.warnings || [])
          const completed = merged.filter((c) => c.status === 'ok' || c.status === 'failed').length
          const isOk = merged.length === totalChunks && merged.every((c) => c.status === 'ok')
          completedCount = completed
          mergedCount = merged.length
          const nextResult: TranslateResult = {
            ok: isOk,
            warnings,
            chunks: merged,
            vtt: stitchedVtt,
            srt: stitchedVtt ? deriveSrt(stitchedVtt) : '',
            video_ref: prev?.video_ref ?? opts.videoRef ?? null,
          }
          resultRef.current = nextResult
          return nextResult
        })
        setProgress(`Completed chunk ${completedCount}/${mergedCount}`)
        void processNextRetry()
      },
    })

    if (runToken === runTokenRef.current) {
      setResult(() => {
        resultRef.current = data
        return data
      })
      setProgress(
        `Completed chunk ${data.chunks.filter((c) => c.status === 'ok' || c.status === 'failed').length}/${data.chunks.length || 0}`,
      )
      setIsRunning(false)
      if (isDebugEnabled()) {
        logDebugEvent({ kind: 'run-finish', runId: runToken })
      }
    }
    return runToken === runTokenRef.current ? data : null
  }

  const retryChunkInternal = async (opts: RetryOptions) => {
    const runToken = runTokenRef.current
    const { chunk } = opts
    if (!chunk.chunk_vtt) throw new Error('No chunk payload available to retry')
    retryingSetRef.current.add(chunk.idx)
    if (isDebugEnabled()) {
      logDebugEvent({ kind: 'retry-enqueue', runId: runToken, chunkIdx: chunk.idx })
    }
    setRetryingChunks(Array.from(retryingSetRef.current))
    setProgress(`Retrying chunk ${chunk.idx}…`)
    try {
      setResult((prev) => {
        if (!prev) return prev
        const now = Date.now()
        const updatedChunks = prev.chunks.map((c) =>
          c.idx === chunk.idx
            ? {
                ...c,
                status: 'processing',
                started_at: now,
                finished_at: 0,
              }
            : c,
        )
        chunkStatusRef.current.set(chunk.idx, 'processing')
        const nextResult: TranslateResult = { ...prev, chunks: updatedChunks }
        resultRef.current = nextResult
        return nextResult
      })
      const updated = await translateChunkFromText({
        idx: chunk.idx,
        chunkVtt: chunk.chunk_vtt || '',
        contextVtt: chunk.context_vtt || '',
        apiKey: opts.apiKey,
        modelName: opts.modelName,
        sourceLang: opts.sourceLang,
        targetLang: opts.targetLang,
        style: opts.style,
        glossary: opts.glossary,
        customPrompt: opts.customPrompt,
        // Context video/audio is intentionally not passed here to avoid extra
        // generation cost/rate-limit hits; change to opts.videoRef if re-enabled.
        videoUri: undefined,
        videoLabel: null,
        mediaKind: undefined,
        temperature: opts.temperature,
        useGlossary: opts.useGlossary && opts.glossary.trim() ? true : false,
        summaryText: opts.useSummary && opts.summaryText ? opts.summaryText.trim() : undefined,
        safetyOff: opts.safetyOff,
        runId: runToken,
      })
      if (runToken === runTokenRef.current) {
        setResult((prev) => {
          if (!prev) return prev
          const newChunks = prev.chunks.map((c) => (c.idx === updated.idx ? { ...c, ...updated } : c))
          const cleanedChunks = newChunks.map((c) =>
            c.idx === updated.idx ? { ...c, warnings: updated.warnings || [] } : c,
          )
          const stitchedVtt = stitchVtt(cleanedChunks.filter((c) => c.status === 'ok').map((c) => c.vtt || ''))
          const newWarnings = cleanedChunks.flatMap((c) => c.warnings || [])
          const overallOk = cleanedChunks.every((c) => c.status === 'ok')
          chunkStatusRef.current.set(updated.idx, updated.status)
          const nextResult: TranslateResult = {
            ...prev,
            chunks: cleanedChunks,
            vtt: stitchedVtt,
            srt: stitchedVtt ? deriveSrt(stitchedVtt) : '',
            warnings: newWarnings,
            ok: overallOk,
          }
          resultRef.current = nextResult
          return nextResult
        })
        setProgress(`Chunk ${chunk.idx} retried.`)
      }
    } finally {
      retryingSetRef.current.delete(opts.chunk.idx)
      setRetryingChunks(Array.from(retryingSetRef.current))
      enqueuedRetryIds.current.delete(opts.chunk.idx)
      setRetryQueueIds((prev) => prev.filter((id) => id !== opts.chunk.idx))
      activeRetriesRef.current = Math.max(0, activeRetriesRef.current - 1)
      retryingRef.current = false
      if (isDebugEnabled()) {
        logDebugEvent({ kind: 'retry-finish', runId: runTokenRef.current, chunkIdx: chunk.idx })
      }
      void processNextRetry()
    }
  }

  const processNextRetry = async () => {
    if (retryingRef.current) return
    while (retryQueueRef.current.length > 0) {
      const totalActive = processingCount() + activeRetriesRef.current
      if (totalActive >= concurrencyRef.current) {
        break
      }
      if (pausedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }
      const next = retryQueueRef.current.shift()
      if (!next) break
      if (next.runToken !== runTokenRef.current) {
        // Drop retries from old runs.
        enqueuedRetryIds.current.delete(next.chunk.idx)
        setRetryQueueIds((prev) => prev.filter((id) => id !== next.chunk.idx))
        continue
      }
      activeRetriesRef.current += 1
      retryingRef.current = true
      if (isDebugEnabled()) {
        logDebugEvent({ kind: 'retry-start', runId: next.runToken, chunkIdx: next.chunk.idx })
      }
      void retryChunkInternal(next)
    }
    retryingRef.current = false
    if (retryQueueRef.current.length === 0 && retryingSetRef.current.size === 0) {
      autoPauseRef.current = false
    }
  }

  const retryChunk = async (opts: RetryOptions) => {
    const runToken = runTokenRef.current
    if (enqueuedRetryIds.current.has(opts.chunk.idx)) return
    enqueuedRetryIds.current.add(opts.chunk.idx)
    retryQueueRef.current.push({ ...opts, runToken })
    concurrencyRef.current = Math.max(1, opts.concurrency || 1)
    setRetryQueueIds((prev) => (prev.includes(opts.chunk.idx) ? prev : [...prev, opts.chunk.idx]))
    autoPauseRef.current = true
    void processNextRetry()
  }

  return {
    state: { progress, result, retryingChunks, retryQueueIds, paused, isRunning },
    actions: {
      setProgress,
      setResult,
      runTranslation,
      retryChunk,
      reset,
      pause: () => {
        pausedRef.current = true
        setPaused(true)
      },
      resume: () => {
        pausedRef.current = false
        setPaused(false)
      },
    },
  }
}
