# Transcription Session Save/Load

> **Type**: Reference | **Status**: Stable | **Last Updated**: 2025-12-10 | **Owner**: Developer/Agent
> **Source of truth**: `src/lib/transcriptionSession.ts`

## Overview

Enables saving and loading transcription progress to/from JSON files. Primary use case: Gemini free tier users limited to 20 RPD who need to spread transcription across multiple days.

## Quick Reference

### Save Progress
1. Run transcription (partial or complete)
2. Click **Save Progress** button in Results section
3. Downloads `transcription-progress-{videoname}-{date}.json`

### Load Progress
1. Click **Load Previous Progress** in Session Progress section
2. Select saved JSON file
3. Upload the same video file
4. Click **Resume Transcription**

## Data Format

```typescript
type TranscriptionSessionExport = {
  savedAt: string;  // ISO timestamp

  video: {
    name: string;
    durationSeconds: number;
  };

  config: {
    modelName: string;
    temperature: number;
    thinkingBudget: number;
    maxOutputTokens?: number;
    topP?: number;
    safetyOff: boolean;
    chunkLengthSeconds: number;
    overlapSeconds: number;
    prompt: string;
  };

  progress: {
    chunks: TranscriptionChunk[];
    cursor?: TranscriptionCursor;
    warnings: string[];
    vtt: string;
    srt: string;
  };

  prompts: {
    systemPrompt: string;
    userPromptTemplate: string;
    schema: object;
    schemaName: string;
  };
};
```

### What Gets Saved

| Category | Fields | Purpose |
|----------|--------|---------|
| **Config** | model, temperature, thinking budget, safety, chunk settings, custom prompt | Restore exact settings |
| **Progress** | chunks (with VTT, status, warnings), cursor, vtt/srt | Resume from where left off |
| **Video** | name, duration | User reference, duration validation |
| **Prompts** | system prompt, user template, JSON schema | Debugging, replay with original prompts |

### What's NOT Saved

| Field | Reason |
|-------|--------|
| API key | Privacy - user re-enters |
| videoRef | Gemini File API purges after 48h |
| Video file | Too large for JSON |

## Implementation

### Key Files

| File | Role |
|------|------|
| `src/lib/transcriptionSession.ts` | Core save/load logic (self-contained) |
| `src/features/transcription/hooks/useTranscription.ts` | `loadSession()` action |
| `src/hooks/useTranslationWorkflowRunner.ts` | Session handlers, state management |
| `src/features/transcription/components/TranscriptionResultView.tsx` | Save button |
| `src/App.tsx` | Load UI, session banner |

### Core Functions

```typescript
// Create export from current state
createSessionExport(
  result: TranscriptionResult,
  config: GeminiTranscriptionConfig,
  videoMeta: { name: string; durationSeconds: number }
): TranscriptionSessionExport;

// Parse and validate JSON import
parseSessionImport(json: string): TranscriptionSessionExport;

// Trigger browser download
downloadSession(session: TranscriptionSessionExport, filename?: string): void;

// Capture current prompts/schema for snapshot
capturePromptsSnapshot(): TranscriptionSessionExport["prompts"];

// Get summary for UI display
getSessionSummary(session: TranscriptionSessionExport): {
  videoName: string;
  videoDuration: number;
  completedChunks: number;
  totalExpectedChunks: number;
  hasRemainingWork: boolean;
  savedAt: Date;
};

// Check video duration match (returns warning or null)
checkVideoDurationMatch(
  session: TranscriptionSessionExport,
  uploadedDuration: number
): string | null;
```

### Workflow Runner Integration

```typescript
// State
state.loadedSession         // Currently loaded session or null
state.loadedSessionSummary  // Computed summary for UI
state.loadedSessionVideoMismatch  // Duration mismatch warning

// Actions
actions.handleLoadSession(file: File)  // Load from file
actions.handleSaveSession()            // Save current progress
actions.clearLoadedSession()           // Clear loaded state
```

### useTranscription Hook

```typescript
// Action to restore state from loaded session
actions.loadSession(session: TranscriptionSessionExport)
```

## Resume Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Load JSON file                                   │
│    └─> parseSessionImport() validates               │
│    └─> handleLoadSession() restores config          │
│    └─> loadSession() restores result state          │
├─────────────────────────────────────────────────────┤
│ 2. User uploads video                               │
│    └─> Duration checked vs saved                    │
│    └─> Video uploaded to Gemini                     │
│    └─> videoRef set                                 │
├─────────────────────────────────────────────────────┤
│ 3. User clicks Resume                               │
│    └─> resumeStructured() called with cursor        │
│    └─> Continues from nextChunkIdx                  │
│    └─> Chunks merged with existing progress         │
└─────────────────────────────────────────────────────┘
```

## Edge Cases

### Different Video Uploaded
- Cannot reliably detect (no video fingerprint)
- Duration mismatch warning if durations differ >2s
- User responsible for using same video

### In-Progress Transcription Replaced
- Confirmation dialog: "Loading will replace current progress"
- User can cancel to preserve current work

### Timestamps Already Absolute
- Structured output uses absolute timestamps (HH:MM:SS.mmm)
- Save/load preserves these correctly
- No double-shifting on resume

## Prompts Snapshot

The `prompts` field captures what prompts/schema were used at save time:

```typescript
prompts: {
  systemPrompt: string;         // From buildTranscriptionPrompt()
  userPromptTemplate: string;   // First chunk template
  schema: object;               // TRANSCRIPTION_JSON_SCHEMA
  schemaName: string;           // "TranscriptionStructuredOutput"
}
```

**Use cases:**
- Inspect exactly what prompts were used
- Debug issues by comparing prompts
- Future: replay with saved vs current prompts

## Testing

1. Start transcription, pause after 2 chunks
2. Click **Save Progress** → JSON downloads
3. Close browser, reopen app
4. Click **Load Previous Progress** → select JSON
5. Verify chunk count restored in UI
6. Upload same video
7. Click **Resume Transcription**
8. Verify continues from correct chunk
9. Complete transcription, verify final VTT includes all chunks

### Error Cases to Test
- Invalid JSON file → error message
- Missing required fields → specific error
- Video duration mismatch → warning displayed
- Load while transcription in progress → confirmation dialog

## Related Docs

- [Structured Transcription Resume](./structured-transcription-resume.md) - Cursor-based resume mechanism
- [Transcription Workflow](./transcription-workflow.md) - Technical chunking details
- [Tokenomics](./tokenomics.md) - Free tier limits that motivate this feature
