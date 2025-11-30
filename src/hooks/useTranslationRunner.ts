import { useState } from 'react'
import { chunkCues } from '../lib/chunker'
import { deriveSrt, stitchVtt } from '../lib/stitcher'
import { translateChunkFromText, translateCues, type ChunkStatus, type TranslateResult } from '../lib/translation'
import { serializeVtt } from '../lib/vtt'

type RunnerOptions = {
  cues: ReturnType<typeof chunkCues>[number]["cues"]
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
}

export function useTranslationRunner() {
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [error, setError] = useState('')
  const [retryingChunk, setRetryingChunk] = useState<number | null>(null)

  const runTranslation = async (
    cues: ReturnType<typeof chunkCues>[number]["cues"],
    opts: Omit<RunnerOptions, 'cues'>,
  ) => {
    setResult(null)
    setProgress('Translating…')
    const previewChunks = chunkCues(cues, opts.chunkSeconds, opts.chunkOverlap)
    const totalChunks = previewChunks.length || 1
    const pendingChunks: ChunkStatus[] = previewChunks.map((chunk) => ({
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

    setResult({
      ok: false,
      warnings: [],
      chunks: pendingChunks,
      vtt: '',
      srt: '',
      video_ref: opts.videoRef || null,
    })

    const handleChunkUpdate = (chunkResult: ChunkStatus) => {
      let completedCount = 0
      let mergedCount = totalChunks
      setResult((prev) => {
        const existing = prev?.chunks || []
        const without = existing.filter((c) => c.idx !== chunkResult.idx)
        const merged = [...without, chunkResult].sort((a, b) => a.idx - b.idx)
        const okParts = merged.filter((c) => c.status === 'ok').map((c) => c.vtt || '')
        const stitchedVtt = okParts.length ? stitchVtt(okParts) : ''
        const warnings = merged.flatMap((c) => c.warnings || [])
        const completed = merged.filter((c) => c.status === 'ok' || c.status === 'failed').length
        const isOk = merged.length === totalChunks && merged.every((c) => c.status === 'ok')
        completedCount = completed
        mergedCount = merged.length
        return {
          ok: isOk,
          warnings,
          chunks: merged,
          vtt: stitchedVtt,
          srt: stitchedVtt ? deriveSrt(stitchedVtt) : '',
          video_ref: prev?.video_ref ?? opts.videoRef ?? null,
        }
      })
      setProgress(`Completed chunk ${completedCount}/${mergedCount}`)
    }

    const data = await translateCues({
      cues,
      apiKey: opts.apiKey,
      modelName: opts.modelName,
      sourceLang: opts.sourceLang,
      targetLang: opts.targetLang,
      style: opts.style,
      glossary: opts.glossary,
      useGlossary: opts.useGlossary && opts.glossary.trim() ? true : false,
      customPrompt: opts.customPrompt,
      videoUri: undefined,
      videoLabel: null,
      mediaKind: undefined,
      concurrency: opts.concurrency,
      temperature: opts.temperature,
      targetSeconds: opts.chunkSeconds,
      overlap: opts.chunkOverlap,
      summaryText: opts.useSummary && opts.summaryText ? opts.summaryText.trim() : undefined,
      onChunkUpdate: handleChunkUpdate,
    })
    setResult(data)
    setProgress(
      `Completed chunk ${data.chunks.filter((c) => c.status === 'ok' || c.status === 'failed').length}/${
        data.chunks.length || 0
      }`,
    )
    return data
  }

  const retryChunk = async (
    chunk: ChunkStatus,
    opts: Pick<RunnerOptions, 'apiKey' | 'modelName' | 'sourceLang' | 'targetLang' | 'style' | 'glossary' | 'useGlossary' | 'customPrompt' | 'temperature' | 'useSummary' | 'summaryText'>,
  ) => {
    if (!chunk.chunk_vtt) throw new Error('No chunk payload available to retry')
    setRetryingChunk(chunk.idx)
    setProgress(`Retrying chunk ${chunk.idx}…`)
    try {
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
        customPrompt:
          opts.useSummary && opts.summaryText
            ? `Media summary:\n${opts.summaryText.trim()}\n\n${opts.customPrompt}`
            : opts.customPrompt,
        videoUri: undefined,
        videoLabel: null,
        mediaKind: undefined,
        temperature: opts.temperature,
        useGlossary: opts.useGlossary && opts.glossary.trim() ? true : false,
        summaryText: opts.useSummary && opts.summaryText ? opts.summaryText.trim() : undefined,
      })
      setResult((prev) => {
        if (!prev) return prev
        const newChunks = prev.chunks.map((c) => (c.idx === updated.idx ? { ...c, ...updated } : c))
        const cleanedChunks = newChunks.map((c) => (c.idx === updated.idx ? { ...c, warnings: [] } : c))
        const stitchedVtt = stitchVtt(cleanedChunks.filter((c) => c.status === 'ok').map((c) => c.vtt || ''))
        const newWarnings = cleanedChunks.flatMap((c) => c.warnings || [])
        const overallOk = cleanedChunks.every((c) => c.status === 'ok')
        return {
          ...prev,
          chunks: cleanedChunks,
          vtt: stitchedVtt,
          srt: stitchedVtt ? deriveSrt(stitchedVtt) : '',
          warnings: newWarnings,
          ok: overallOk,
        }
      })
      setProgress(`Chunk ${chunk.idx} retried.`)
    } finally {
      setRetryingChunk(null)
    }
  }

  return {
    state: { progress, result, error, retryingChunk },
    actions: { setProgress, setResult, setError, runTranslation, retryChunk },
  }
}
