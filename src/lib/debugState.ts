// Lightweight debug event buffer. Safe in browser; no filesystem access.
// Intended for development: emit structured events and optionally attach a writer
// (e.g., console or a download/export hook).

type DebugEvent = {
  ts: number
  kind: string
  runId?: number
  chunkIdx?: number
  message?: string
  data?: Record<string, unknown>
}

const MAX_ENTRIES = 500
let buffer: DebugEvent[] = []
let enabled = false
let writer: ((event: DebugEvent) => void) | null = null

export function enableDebugEvents() {
  enabled = true
}

export function disableDebugEvents() {
  enabled = false
}

export function setDebugWriter(fn: ((event: DebugEvent) => void) | null) {
  writer = fn
}

export function logDebugEvent(event: Omit<DebugEvent, 'ts'>) {
  const entry: DebugEvent = { ts: Date.now(), ...event }
  buffer = [entry, ...buffer].slice(0, MAX_ENTRIES)
  if (!enabled) return
  try {
    writer?.(entry)
  } catch {
    // ignore writer errors
  }
}

export function getDebugBuffer() {
  return buffer.slice()
}

export function copyDebugBuffer(): string {
  return buffer
    .slice()
    .reverse()
    .map((e) =>
      JSON.stringify(
        {
          ts: new Date(e.ts).toISOString(),
          kind: e.kind,
          runId: e.runId,
          chunkIdx: e.chunkIdx,
          message: e.message,
          data: e.data,
        },
        null,
        2,
      ),
    )
    .join('\n')
}
