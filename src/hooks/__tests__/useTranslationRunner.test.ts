import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useTranslationRunner } from '../useTranslationRunner'

type TranslateCuesOpts = Parameters<typeof import('../../lib/translation').translateCues>[0]
type ChunkStatus = import('../../lib/translation').ChunkStatus

const translateCuesMock = vi.fn()
const translateChunkFromTextMock = vi.fn()

vi.mock('../../lib/translation', async () => {
  const actual = await vi.importActual<typeof import('../../lib/translation')>('../../lib/translation')
  return {
    ...actual,
    translateCues: translateCuesMock,
    translateChunkFromText: translateChunkFromTextMock,
  }
})

describe('useTranslationRunner', () => {
  const baseOpts = {
    chunkSeconds: 600,
    chunkOverlap: 2,
    apiKey: 'key',
    modelName: 'model',
    sourceLang: 'ja',
    targetLang: 'en',
    style: 'natural',
    glossary: '',
    useGlossary: false,
    customPrompt: '',
    concurrency: 2,
    temperature: 0.2,
    useSummary: false,
    summaryText: '',
    videoRef: null as string | null,
  }

  const mkChunk = (idx = 0): ChunkStatus => ({
    idx,
    status: 'ok',
    tokens_estimate: 1,
    warnings: [],
    vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi',
    raw_vtt: '',
    raw_model_output: '',
    chunk_vtt: '',
    context_vtt: '',
    prompt: '',
    started_at: 0,
    finished_at: 0,
  })

  beforeEach(() => {
    translateCuesMock.mockReset()
    translateChunkFromTextMock.mockReset()
  })

  it('runs translation and updates progress/result', async () => {
    translateCuesMock.mockImplementation(async (opts: TranslateCuesOpts) => {
      opts.onChunkUpdate?.(mkChunk())
      return {
        ok: true,
        warnings: [],
        chunks: [mkChunk()],
        vtt: 'WEBVTT',
        srt: 'SRT',
        video_ref: null,
      }
    })

    const { result } = renderHook(() => useTranslationRunner())

    await act(async () => {
      await result.current.actions.runTranslation({
        ...baseOpts,
        cues: [{ start: 0, end: 1, text: 'hi' }],
      })
    })

    expect(translateCuesMock).toHaveBeenCalled()
    expect(result.current.state.result?.ok).toBe(true)
    expect(result.current.state.progress).toContain('Completed chunk')
  })

  it('retries a chunk and clears retrying state', async () => {
    // Seed initial result
    translateCuesMock.mockResolvedValue({
      ok: true,
      warnings: [],
      chunks: [mkChunk()],
      vtt: 'WEBVTT',
      srt: 'SRT',
      video_ref: null,
    })

    translateChunkFromTextMock.mockResolvedValue({
      ...mkChunk(),
      vtt: 'UPDATED',
    })

    const { result } = renderHook(() => useTranslationRunner())

    await act(async () => {
      await result.current.actions.runTranslation({
        ...baseOpts,
        cues: [{ start: 0, end: 1, text: 'hi' }],
      })
    })

    await act(async () => {
      await result.current.actions.retryChunk({
        chunk: mkChunk(),
        apiKey: baseOpts.apiKey,
        modelName: baseOpts.modelName,
        sourceLang: baseOpts.sourceLang,
        targetLang: baseOpts.targetLang,
        style: baseOpts.style,
        glossary: baseOpts.glossary,
        useGlossary: baseOpts.useGlossary,
        customPrompt: baseOpts.customPrompt,
        temperature: baseOpts.temperature,
        useSummary: baseOpts.useSummary,
        summaryText: baseOpts.summaryText,
      })
    })

    expect(translateChunkFromTextMock).toHaveBeenCalled()
    expect(result.current.state.retryingChunk).toBeNull()
    expect(result.current.state.result?.chunks[0].vtt).toBe('UPDATED')
  })
})
