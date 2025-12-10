# Structured Transcription Retry/Resume

> **Status**: Implemented
> **Scope**: Structured Gemini transcription (chunked)
> **Audience**: Developers/agents

## Summary

Structured transcription now properly supports retry and resume workflows. When a chunk fails or requires review, the transcription pauses with a cursor that allows resuming from where it left off.

## Implementation

### TranscriptionCursor

A new `TranscriptionCursor` type stores the state needed to resume:

```typescript
type TranscriptionCursor = {
  nextVideoStart: number;      // Where to start the next chunk (seconds)
  nextCueNumber: number;       // Sequential cue numbering
  lastTwoCues?: TranscriptionCue[];  // Context for next chunk's prompt
  nextChunkIdx: number;        // Which chunk index to process next
  videoDuration: number;       // Total video duration
};
```

### Key Changes

1. **`transcribeGeminiStructured`** (gemini-structured.ts)
   - Accepts optional `initialCursor` parameter for resuming
   - On failure or critical warning, returns partial result with cursor instead of breaking
   - Cursor contains all state needed to continue: video position, cue context, chunk index

2. **`useTranscription` hook** (useTranscription.ts)
   - Added `resumeStructured(config)` action that re-enters the loop with cursor
   - `retryChunk` now advances cursor after successful retry using `lastTwoCues` from structured output
   - Result includes cursor when there's remaining work

3. **`useTranslationWorkflowRunner`** (useTranslationWorkflowRunner.ts)
   - `resumeTranscription` detects cursor and calls `resumeStructured` with config
   - Falls back to simple toggle for non-cursor cases (legacy flow)

4. **UI** (TranscriptionResultView.tsx)
   - Shows "Paused for review" banner when cursor exists
   - Displays completed chunk count and Resume button
   - Per-chunk Retry buttons still available

5. **Resume guardrails**
   - Resume is disabled while a transcription run/resume is active to prevent overlapping runs and duplicate chunk sends.

## Workflow

### Failure Scenario
1. Chunk 2 fails (JSON parse error)
2. Runner returns with `cursor.nextChunkIdx = 2` (pointing to failed chunk)
3. UI shows "Paused for review" with Resume button
4. User clicks Retry on failed chunk → chunk succeeds
5. `retryChunk` advances cursor to `nextChunkIdx = 3` using structured output
6. User clicks Resume → `resumeStructured` continues from chunk 3

### Critical Warning Scenario
1. Chunk 2 succeeds but has critical warnings (`requiresResume = true`)
2. Runner returns with `cursor.nextChunkIdx = 3` (pointing to next chunk)
3. UI shows "Paused for review"
4. User reviews warnings, optionally retries chunk 2
5. User clicks Resume → continues from chunk 3

## Future: Save/Load

The cursor approach enables future save/load functionality:

```typescript
// Save progress
const saveState = {
  cursor: result.cursor,
  chunks: result.chunks,
  config: { ...config, apiKey: undefined }
};
localStorage.setItem('transcription-progress', JSON.stringify(saveState));

// Load and resume
const saved = JSON.parse(localStorage.getItem('transcription-progress'));
await resumeStructured({ ...saved.config, apiKey: userApiKey });
```

The cursor is fully serializable (primitives only) and decoupled from VTT parsing internals.

## Testing

To test the resume flow:
1. Start a transcription with a multi-chunk video
2. Simulate failure by disconnecting network mid-run, or wait for an actual failure
3. Verify "Paused for review" banner appears
4. Click Retry on failed chunk
5. Click Resume and verify remaining chunks are processed
6. Verify final VTT contains all chunks stitched correctly
