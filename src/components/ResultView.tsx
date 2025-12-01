import React, { useState } from 'react'
import { TranslateResult, ChunkStatus } from '../lib/translation'
import { Button } from './ui/Button'
import { SectionCard } from './ui/SectionCard'
import { useTheme } from '../lib/themeContext'

function formatTimestamp(ts?: number): string {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString()
}

type Props = {
    result: TranslateResult | null
    handleRetryChunk: (chunk: ChunkStatus) => void
    retryingChunks: number[]
    retryQueueIds?: number[]
}

function downloadText(filename: string, content: string, type = 'text/plain') {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export function ResultView({ result, handleRetryChunk, retryingChunks, retryQueueIds = [] }: Props) {
    const theme = useTheme()
    const [showPreview, setShowPreview] = useState(false)
    if (!result) return null

    return (
        <SectionCard title="Results">
            <div className="flex gap-2 mb-4">
                <Button tone="primary" onClick={() => downloadText('translated.vtt', result.vtt)} disabled={!result.vtt}>
                    Download VTT
                </Button>
                <Button tone="primary" onClick={() => downloadText('translated.srt', result.srt)} disabled={!result.srt}>
                    Download SRT
                </Button>
            </div>
            <div className="flex gap-2 mb-4">
                <Button
                    tone="secondary"
                    onClick={() => setShowPreview((prev) => !prev)}
                    disabled={!result.vtt}
                >
                    {showPreview ? 'Hide preview' : 'Show VTT preview'}
                </Button>
            </div>
            {showPreview && result.vtt && (
                <div
                    className="mb-4 p-3 rounded border text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
                    style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor }}
                >
                    {result.vtt}
                </div>
            )}

            {result.warnings.length > 0 && (
                <div className={`mb-4 p-3 rounded text-sm ${theme.well.warning}`}>
                    <h3 className="font-bold mb-1">Warnings:</h3>
                    <ul className="list-disc list-inside">
                        {result.warnings.slice(0, 5).map((w, i) => (
                            <li key={i}>{w}</li>
                        ))}
                        {result.warnings.length > 5 && <li>...and {result.warnings.length - 5} more</li>}
                    </ul>
                </div>
            )}

            <div className="space-y-2">
                <h3 className="font-medium">Chunks</h3>
                {result.chunks.map((chunk) => (
                    <div
                        key={chunk.idx}
                        className={`p-2 rounded border text-sm ${chunk.status === 'ok'
                            ? theme.statusCard.ok
                            : chunk.status === 'failed'
                                ? theme.statusCard.failed
                                : theme.statusCard.neutral
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Chunk {chunk.idx}</span>
                            <div className="flex items-center gap-2">
                                {chunk.started_at ? (
                                    <span className="text-xs text-slate-500 dark:text-slate-300">
                                        started {formatTimestamp(chunk.started_at)}
                                    </span>
                                ) : null}
                                <span
                                    className={`px-2 py-0.5 rounded text-xs ${chunk.status === 'ok'
                                        ? theme.badge.ok
                                        : chunk.status === 'failed'
                                            ? theme.badge.error
                                            : theme.badge.neutral
                                        }`}
                                >
                                    {chunk.status}
                                </span>
                                {(chunk.model_name || chunk.temperature !== undefined || chunk.duration_ms !== undefined) && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                                        {chunk.model_name && <span>{chunk.model_name}</span>}
                                        {chunk.temperature !== undefined && <span>· temp {chunk.temperature}</span>}
                                        {chunk.duration_ms !== undefined && (
                                            <span>· {Math.max(chunk.duration_ms / 1000, 0).toFixed(1)}s</span>
                                        )}
                                    </div>
                                )}
                                {chunk.status === 'failed' && (
                                    // Allow queuing multiple retries; disable only if this chunk is already queued or running.
                                    <Button
                                        className="text-xs px-2 py-1"
                                        tone="secondary"
                                        onClick={() => handleRetryChunk(chunk)}
                                        disabled={retryingChunks.includes(chunk.idx) || retryQueueIds.includes(chunk.idx)}
                                    >
                                        {retryingChunks.includes(chunk.idx)
                                            ? 'Retrying...'
                                            : retryQueueIds.includes(chunk.idx)
                                                ? 'Queued'
                                                : 'Retry'}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {chunk.warnings.length > 0 && (
                            <div className={`mt-1 text-xs ${theme.warningText}`}>
                                {chunk.warnings.map((w, i) => (
                                    <div key={i}>⚠️ {w}</div>
                                ))}
                            </div>
                        )}
                        <details className="mt-2">
                            <summary className={`cursor-pointer text-xs ${theme.mutedText}`}>
                                Show details (Prompt, Raw Output, Parsed VTT)
                            </summary>
                            <div className="mt-2 space-y-2">
                                <div>
                                    <p className="text-xs font-semibold">Prompt Sent:</p>
                                    <pre
                                        className="p-2 rounded border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto"
                                        style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor }}
                                    >
                                        {chunk.prompt || '(no prompt recorded)'}
                                    </pre>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold">Raw Model Output:</p>
                                    <pre
                                        className="p-2 rounded border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto"
                                        style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor }}
                                    >
                                        {chunk.raw_model_output || '(no output)'}
                                    </pre>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold">Parsed VTT:</p>
                                    <pre
                                        className="p-2 rounded border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto"
                                        style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor }}
                                    >
                                        {chunk.vtt || '(no valid vtt)'}
                                    </pre>
                                </div>
                            </div>
                        </details>
                    </div>
                ))}
            </div>
        </SectionCard>
    )
}
