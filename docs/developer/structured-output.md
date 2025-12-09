# Structured Output Design

> **Type**: Spec | **Status**: Transcription stable, Translation WIP | **Last Updated**: 2025-12-09 | **Owner**: Engineering  
> **Source of truth**: App implementation + this doc

## Scope & Constraints

This is a solo hobby project. See [MISSION.md](./MISSION.md).

**Key constraints:**
- Transcription is the primary feature; Gemini File API only (structured mode).
- Translation is structured-only and WIP; targets Gemini 2.5/3 and OpenAI GPT-4+. Claude untested; Ollama model-dependent and low priority.
- Prompts and tuning focus on Japanese comedy content.
- "Good enough to share" quality target.

## Overview

Structured JSON output enables comedy-specific features (speaker tracking, visual context, wordplay notes) while maintaining VTT compatibility through conversion.

## Why Structured Output?

**Problems with VTT-only:**
- No speaker metadata (just text)
- No visual context storage
- No wordplay notes
- Can't distinguish sound effects from dialogue
- Hard to edit programmatically

**Structured JSON enables:**
- Speaker identification and tracking
- Visual context preservation
- Wordplay detection and explanation
- Sound effect annotations
- Programmatic editing and analysis

## Evolution Strategy

**Current (transcription)**: Structured JSON via Gemini File API is the default path.
```
Video → Gemini (structured) → JSON → VTT
```

**Current (translation)**: Structured translation is being rolled out; legacy VTT-only translation exists but will be replaced.
```
VTT/SRT → compact JSON → structured LLM → JSON → VTT
```

**Plan:**
1. Keep structured transcription as default (Gemini only).
2. Ship structured translation adapters for Gemini 2.5/3 and OpenAI GPT-4+.
3. Deprecate non-structured translation once adapters are stable.

## Core Schema
```typescript
interface TranscriptionCue {
  start_seconds: number;      // 0.1s precision
  end_seconds: number;
  text: string;               // Japanese transcription
  speaker: string;            // From name card or "Unknown"
  
  // Optional fields (add as proven useful)
  notes?: string;             // Catch-all for visual context, wordplay, etc.
  sound_effects?: string[];   // 笑い声, 拍手, etc.
}

interface StructuredTranscription {
  cues: TranscriptionCue[];
  metadata: {
    engine: string;           // "gemini-2.5-flash"
    duration?: number;
    language: string;         // "ja"
    format?: string;          // e.g., "manzai", "variety"
  };
}
```

**Start minimal. Add fields only when needed.**

## Translation Schema

LLM-facing schema stays minimal: one item per cue with an optional merge flag. Input to the LLM is compact (cue number, timing, text). The LLM returns the same order with a merge hint so we can rebuild VTT timings.

```typescript
type StructuredTranslationItem = {
  id: number;                // 1-based cue number
  text: string;              // translated text (can be empty when merged)
  merge_with_next?: boolean; // optional flag to merge with the next cue
};

type StructuredTranslationOutput = {
  translations: StructuredTranslationItem[];
};
```

Reconstruction walks cues in order, merges adjacent cues when `merge_with_next` is true, and uses the original timings (min start, max end across the merged group).

Cue hinting options (UI):
- **Duration hints**: include per-cue duration to guide merges.
- **[SHORT] tags**: mark sub-1.5s cues with `[SHORT]` and omit duration text to reduce clutter; prompts require merges only on tagged cues.

## API Support

**Transcription**: Gemini File API only (structured mode).

**Translation targets** (structured output):
- **Gemini 2.5 / 3**: `response_mime_type: "application/json"` + `response_schema`.
- **OpenAI GPT-4+**: `response_format: { type: "json_schema" }` / JSON mode.
- **Claude**: Not tested yet; evaluate `output_format` when ready.
- **Ollama**: Model-dependent structured support; low priority.

## File Structure
```
src/
  types/
    core.ts                    # Shared primitives only
    
  formats/
    vtt/
      types.ts                 # VTT-specific
      parser.ts
      writer.ts
    json/
      types.ts                 # Structured-specific
      schemas.ts               # Zod schemas
      parser.ts
      writer.ts
    converters.ts              # JSON ↔ VTT bridge
    
  workflows/
    vtt/
      transcription.ts         # Path A (existing)
      translation.ts
      state.ts
    structured/
      transcription.ts         # Path B (new)
      translation.ts
      state.ts
      
  comedy/                      # Comedy-specific features
    gemini/
      client.ts
      prompts.ts
    presets/
      types.ts
      presets.ts               # Show format definitions
    translation/
      adapters/                # Per-API adapters
        gemini.ts
        claude.ts
        openai.ts
        ollama.ts
      unified.ts               # Common interface
```

## Gemini Transcription Settings
```typescript
const settings = {
  model: "gemini-2.5-flash",
  response_mime_type: "application/json",
  response_schema: TranscriptionCueSchema,  // Zod → JSON Schema
  
  // Video processing
  generation_config: {
    video: {
      resolution: "low",       // Default, sufficient for name cards
      fps: 1                   // Default, adequate for on-screen text
    }
  }
};
```

**Chunking:**
- **1 minute per chunk** (critical — see Validation Findings below)
- 5 second overlap (prevent word cutoff)
- Deduplicate overlap region (±1s timestamp tolerance)

## Validation Findings

> **Status**: Validated with test scripts. Key constraint: **1-minute chunks required**.

### Test Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `test-structured-transcription.ts` | Main transcription test with full schema |
| `test-structured-translation.ts` | Translation test preserving speaker context |
| `convert-to-vtt.ts` | JSON → VTT converter with speaker/notes options |
| `align-by-time.ts` | Time-based alignment with Whisper (experimental) |
| `test-minimal-transcription.ts` | Minimal schema variant (debugging) |
| `test-compact-transcription.ts` | Compact format variant (debugging) |

**Usage:**
```bash
# Transcription (uses GEMINI_MODEL env var, defaults to gemini-2.5-pro)
npm run test:structured path/to/video.mp4

# With different model
GEMINI_MODEL=gemini-2.5-flash npm run test:structured video.mp4

# Translation
npm run test:translate transcription.json --lang en

# Convert to VTT
npm run convert:vtt translation.json --include-speaker > output.vtt
```

### Key Findings

**Chunk Duration Limits:**

| Duration | Pro | Flash | Result |
|----------|-----|-------|--------|
| 3 min | Skips ~40s of content | Skips content | ❌ |
| 2 min | Gaps around 60s | Timestamps wrap at 60s | ❌ |
| **1 min** | Continuous coverage | Continuous coverage | ✅ |

**Token Usage (1-min 720p 5fps video):**
- Input: ~18k tokens
- Output: ~2.5k tokens

**Model Comparison:**

| Aspect | gemini-2.5-pro | gemini-2.5-flash |
|--------|----------------|------------------|
| Speaker names | Japanese (浜田雅功) | Sometimes romanized |
| Transcription | More accurate | Some errors |
| Speed | Slower, stricter limits | Faster |
| Visual notes | Richer context | Basic |

**Validated Capabilities:**
- ✅ Speaker identification from タイトルカード (name cards)
- ✅ Visual context in notes field
- ✅ Sound effect detection (拍手, 笑い声)
- ✅ Structured JSON output with schema validation
- ✅ Translation preserving speaker context

### Prompt Guidelines

Added to transcription prompt (validated):
```
CUE LENGTH GUIDELINES:
- Keep each cue short: maximum ~20 Japanese characters
- Split long sentences at natural pause points (、。 or breath pauses)
- Each cue should be 2-6 seconds long
- If someone speaks continuously for more than 6 seconds, split into multiple cues
- Aim for 4-7 characters per second (CPS) for comfortable reading
```

### Why Alignment Failed

**Problem:** Whisper has accurate timing but wrong text (especially proper nouns).
Gemini has correct text but timing drifts on longer clips.

**Attempted solutions:**
1. Text similarity (Levenshtein) — too slow, Kanji mismatch issues
2. Phonetic normalization — complexity not justified
3. Time-based overlap — works but doesn't fix content gaps

**Solution:** Use 1-minute chunks to keep Gemini timing accurate. No alignment needed.

### Recommended Pipeline

```
Video → FFmpeg split (1-min chunks with overlap)
      → Gemini transcribe each chunk (structured)
      → Offset timestamps + merge overlapping cues
      → Translate (structured) via Gemini 2.5/3 or GPT-4+
      → Convert to VTT
```

### Development with Mock Mode

> **Note**: With free tier limited to ~40 RPD, use mock mode for pipeline development.

**Strategy:**
- Save test outputs as JSON fixtures
- Add `--mock` flag to transcription scripts
- Mock returns cached fixture instead of calling API
- Structured output makes validation easy (schema guarantees shape)
- Test stitching, offset, dedup logic without burning API calls

```bash
# Real API (uses limited quota)
npm run test:structured video.mp4

# Mock mode (uses saved fixtures)
npm run test:structured video.mp4 --mock
```

## Show Format Presets (Deferred)

> **Status**: Not implementing until generic prompts proven insufficient

Presets (manzai, variety, etc.) add complexity before we know they're needed.
Test generic prompts first; add presets only if specific formats consistently fail.

## Base Prompt Template
```typescript
const BASE_PROMPT = `
Transcribe this Japanese comedy video segment.

Return JSON array of cues with:
- start_seconds, end_seconds: timing (round to 0.1s)
- text: Japanese transcription
- speaker: name from on-screen card, or "Unknown"
- notes: (optional) visual context, wordplay, reactions
- sound_effects: (optional) ["笑い声", "拍手", etc.]

{PRESET_ADDITIONS}

{CONTEXT_FROM_PREVIOUS}
`;
```

**Keep it simple. Let Gemini do its thing. Add constraints only when testing reveals failures.**

## Translation Approach
```typescript
async function translateStructured(
  cues: TranscriptionCue[],
  api: "gemini" | "claude" | "openai" | "ollama",
  model: string
): Promise<StructuredTranslation>
```

**Unified interface, API-specific adapters:**
```typescript
// adapters/gemini.ts
export async function translateWithGemini(
  cues: TranscriptionCue[],
  model: string
): Promise<TranslationCue[]> {
  const schema = TranslationCueSchema.array();
  return gemini.generateContent({
    model,
    response_mime_type: "application/json",
    response_schema: zodToJsonSchema(schema),
    contents: buildTranslationPrompt(cues)
  });
}

// Similar for claude.ts, openai.ts, ollama.ts
```

## VTT Conversion
```typescript
// For download compatibility
export function structuredToVTT(
  transcription: StructuredTranscription
): string {
  const cues = transcription.cues.map(cue => {
    let text = cue.speaker !== "Unknown" 
      ? `${cue.speaker}: ${cue.text}`
      : cue.text;
    
    if (cue.sound_effects?.length) {
      text += ` [${cue.sound_effects.join(", ")}]`;
    }
    
    return formatVTTCue(cue.start_seconds, cue.end_seconds, text);
  });
  
  return `WEBVTT\n\n${cues.join("\n\n")}`;
}
```

## State Management

**Separate stores for each path:**
```typescript
// workflows/structured/state.ts
interface StructuredState {
  transcription: StructuredTranscription | null;
  translation: StructuredTranslation | null;
  selectedPreset: string | null;
  isProcessing: boolean;
}

export const useStructuredStore = create<StructuredState>(/* ... */);

// workflows/vtt/state.ts - completely independent
```

## UI Separation
```typescript
// App.tsx
type WorkflowMode = 'vtt' | 'structured';

function App() {
  const [mode, setMode] = useState<WorkflowMode>('structured');
  
  return (
    <>
      <nav>
        <button onClick={() => setMode('structured')}>
          Comedy Mode
        </button>
        <button onClick={() => setMode('vtt')}>
          Simple VTT
        </button>
      </nav>
      
      {mode === 'structured' 
        ? <StructuredWorkflow /> 
        : <VTTWorkflow />
      }
    </>
  );
}
```

## Implementation Strategy

**Phase 1: Minimal viable**
1. Define base schema (just start/end/text/speaker)
2. Implement Gemini client with simple prompt
3. Test on 5-10 videos
4. Observe what breaks

**Phase 2: Iterate based on real failures**
1. Add fields to schema only if needed
2. Refine prompt based on actual errors
3. Add 2-3 basic presets if format differences matter

**Phase 3: Translation**
1. Implement one API adapter (Gemini)
2. Test quality
3. Add other adapters (Claude, OpenAI, Ollama)

**Phase 4: Polish**
1. UI for preset selection
2. JSON editor (if users want it)
3. Download options (VTT + JSON)

## Key Principles

1. **Start simple** - Minimal schema, let Gemini be smart
2. **Independent paths** - VTT and structured never touch
3. **Add complexity only when proven necessary**
4. **Test with real content** - Don't optimize blind
5. **Conversion, not tight coupling** - Bridge formats explicitly

## What Not To Do

❌ Don't over-engineer schema with 20+ fields upfront
❌ Don't micromanage Gemini with overly detailed prompts
❌ Don't build presets before testing generic version
❌ Don't couple VTT and structured workflows
❌ Don't add features "just in case"

## Success Criteria

- ✅ JSON output is valid and type-safe
- ✅ Can convert JSON → VTT for download
- ✅ Gemini produces useful speaker/context data
- ✅ Quality is "good enough to share"

## Out of Scope

- Real-time streaming transcription
- Backend services
- Multi-language prompt variants
- Broadcast-quality guarantees
- Feature parity across all providers
- Presets before validation
