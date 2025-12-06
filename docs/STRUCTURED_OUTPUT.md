# Structured Output Design

> **Status**: Experimental (not yet implemented)  
> **Branch**: `structured-output`  
> **Related**: [MISSION.md](./MISSION.md), [design.md](./design.md)

## Scope & Constraints

This is a solo hobby project. See [MISSION.md](./MISSION.md).

**Key constraints:**
- Prompts tested with Japanese comedy content
- "Good enough to share" quality target
- Gemini-only initially (only provider with media upload for visual comedy)
- Other providers added only if validated

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

**Current** (`main` branch): VTT-only workflow
```
Audio → Whisper → VTT → Translate → VTT
```

**Experimental** (`structured-output` branch): Structured JSON workflow
```
Video → Gemini → JSON → Translate → JSON → Convert to VTT
```

**Migration path:**
1. Validate structured output works (this branch)
2. If successful: structured becomes default
3. VTT mode becomes "legacy/compatibility" option

**Not planned**: Indefinite parallel development of both paths.

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
```typescript
interface TranslationCue extends TranscriptionCue {
  english_text: string;       // Translated text
  translation_notes?: string; // Wordplay explanations, cultural notes
}

interface StructuredTranslation {
  cues: TranslationCue[];
  metadata: {
    source_language: string;
    target_language: string;
    api: string;              // "gemini" | "claude" | "openai" | "ollama"
  };
}
```

## API Support

**Initial implementation**: Gemini only
- Only provider with media upload (essential for visual comedy context)
- Structured output via `response_mime_type: "application/json"` + `response_schema`

**Future consideration** (only if Gemini validated):
- OpenAI: `response_format: {"type": "json_schema"}`
- Claude: `output_format` + beta header
- Ollama: `format` parameter

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
- 2 minutes per chunk (balance context and API limits)
- 5 second overlap (prevent word cutoff)
- Deduplicate overlap region (±1s timestamp tolerance)

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
