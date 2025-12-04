# Provider-Specific UI Architecture

> **Status**: Design Document  
> **Date**: 2025-12-03  
> **Related**: [providers.md](./providers.md), [MULTI_PROVIDER_CHANGES.md](./MULTI_PROVIDER_CHANGES.md)

## Overview

This document outlines the architecture for implementing provider-specific UI features while maintaining a consistent application skeleton. It addresses two key design decisions:

1. **Where and how should provider-specific UI elements appear?**
2. **Should API variants (e.g., OpenAI Chat vs Whisper) be separate providers?**

---

## Part 1: Dynamic UI Architecture

### Core Principle: Effective Capabilities

The UI dynamically adapts based on **effective capabilities** — a combination of:
- Base provider capabilities
- Provider-specific settings (e.g., transcription enabled)
- Feature toggles

```typescript
effectiveCapabilities = baseCapabilities + providerSettings + featureFlags
```

### Media Upload Example

Media files serve different purposes depending on the provider:

| Provider Config | Purpose | Required? | Label |
|----------------|---------|-----------|-------|
| Gemini (default) | Context augmentation | Optional | "🎬 Media (Optional)" |
| OpenAI Chat (default) | Not supported | N/A | Hidden + info message |
| OpenAI + Whisper enabled | Transcription → VTT | Required* | "🎤 Audio (Transcription)" |
| Anthropic | Not supported | N/A | Hidden + info message |

\* Required if no VTT file is provided

### Implementation Pattern

#### 1. Compute Effective Capabilities

```typescript
// In App.tsx or custom hook
const effectiveCapabilities = useMemo(() => {
  const base = getProviderCapabilities(selectedProvider);
  
  // Apply provider-specific overrides
  if (selectedProvider === 'openai') {
    return {
      ...base,
      supportsMediaUpload: providerConfigs.openai.transcriptionEnabled,
      mediaUploadPurpose: providerConfigs.openai.transcriptionEnabled 
        ? 'transcription' 
        : null,
    };
  }
  
  if (selectedProvider === 'gemini') {
    return {
      ...base,
      supportsMediaUpload: true,
      mediaUploadPurpose: 'context', // Supplements translation
    };
  }
  
  return base;
}, [selectedProvider, providerConfigs]);
```

#### 2. Dynamic Labels and Messaging

```typescript
const getMediaSectionConfig = () => {
  if (!effectiveCapabilities.supportsMediaUpload) {
    return {
      show: false,
      infoMessage: getMediaUnavailableMessage(),
    };
  }
  
  switch (effectiveCapabilities.mediaUploadPurpose) {
    case 'transcription':
      return {
        show: true,
        title: '🎤 Audio/Video File',
        subtitle: 'Transcription',
        helperText: `Whisper API will ${
          providerConfigs.openai.transcriptionMode === 'translate'
            ? 'transcribe and translate to English'
            : 'transcribe in original language'
        }.`,
        required: !vttFile, // Required if no VTT provided
      };
    
    case 'context':
      return {
        show: true,
        title: '🎬 Media File',
        subtitle: 'Optional',
        helperText: 'Provides visual and audio context for better translation.',
        required: false,
      };
    
    default:
      return { show: false };
  }
};
```

#### 3. Conditional Rendering in Components

```typescript
// FileUploader.tsx
export function FileUploader({ 
  effectiveCapabilities,
  mediaConfig,
  // ... other props
}) {
  return (
    <SectionCard title="File Upload">
      {/* VTT - Always visible */}
      <div className="space-y-2 mb-4">
        <FieldLabel>📄 Subtitle File (VTT/SRT)</FieldLabel>
        <input type="file" accept=".vtt,.srt" onChange={handleVttUpload} />
        {mediaConfig?.show && (
          <p className={theme.helperText}>
            Or upload audio below to generate VTT automatically.
          </p>
        )}
      </div>
      
      {/* Media - Conditional */}
      {mediaConfig?.show ? (
        <div className="space-y-2 animate-fade-in">
          <FieldLabel>
            {mediaConfig.title} {mediaConfig.subtitle && `(${mediaConfig.subtitle})`}
          </FieldLabel>
          <input type="file" accept="audio/*,video/*" onChange={handleMediaUpload} />
          <p className={theme.helperText}>{mediaConfig.helperText}</p>
        </div>
      ) : (
        mediaConfig?.infoMessage && (
          <div className="info-box">
            <p className="text-sm">{mediaConfig.infoMessage}</p>
          </div>
        )
      )}
    </SectionCard>
  );
}
```

### Benefits of This Approach

✅ **Single source of truth**: Capabilities computed from provider + settings  
✅ **No code duplication**: Same component adapts to all providers  
✅ **Type-safe**: TypeScript validates capabilities  
✅ **Maintainable**: Easy to add new providers or features  
✅ **User-friendly**: Clear messaging about why features are/aren't available  
✅ **Smooth UX**: CSS transitions prevent jarring layout shifts  

---

## Part 2: API Variants as Providers

### The Question

Should OpenAI's different APIs be separate providers?

- **Option A**: Single provider with settings (OpenAI + transcription toggle)
- **Option B**: Separate providers (OpenAI Chat vs OpenAI Audio)

### Analysis

#### OpenAI API Structure

OpenAI now offers multiple transcription models with different capabilities:

```
OpenAI Platform (one API key)
├── Chat Completions API (/v1/chat/completions)
│   ├── gpt-4o, gpt-4-turbo, gpt-3.5-turbo
│   └── Purpose: Text generation, translation
│
├── Audio Transcriptions API (/v1/audio/transcriptions)
│   ├── whisper-1 (legacy, supports VTT/SRT output ✓)
│   ├── gpt-4o-transcribe (higher quality, json/text only)
│   ├── gpt-4o-mini-transcribe (faster, json/text only)
│   └── gpt-4o-transcribe-diarize (speaker labels, json/text/diarized_json)
│   └── Purpose: Audio → Text (same language)
│
└── Audio Translations API (/v1/audio/translations)
    ├── whisper-1 only (supports VTT/SRT output ✓)
    └── Purpose: Audio → English text (any source language)
```

**Key Capabilities:**

| Model | VTT Output | Translation | Diarization | Prompting | Best For |
|-------|------------|-------------|-------------|-----------|----------|
| `whisper-1` | ✅ Yes | ✅ Yes | ❌ No | Limited | **Subtitle workflows** |
| `gpt-4o-transcribe` | ❌ No (json/text) | ❌ No | ❌ No | ✅ Good | High-quality transcription |
| `gpt-4o-mini-transcribe` | ❌ No (json/text) | ❌ No | ❌ No | ✅ Good | Fast transcription |
| `gpt-4o-transcribe-diarize` | ❌ No (json/diarized_json/text) | ❌ No | ✅ Yes | ❌ No | Speaker identification |

**Critical for Subtitle Workflows:**
- Only **`whisper-1`** supports `vtt` and `srt` response formats and its timestamps are quantized to 1s resolution
- GPT-4o models produce `json` or `text`, requiring manual conversion to VTT (we use them as text-only context for summaries)
- We chunk long media client-side (configurable length, default 600s) and can run chunks in parallel (bounded pool) to fit GPT-4o limits; Whisper can use larger chunks but still benefits from chunking for responsiveness

#### Workflow Integration

The APIs serve different roles in the translation workflow:

**Scenario 1: Direct Translation (No audio)**
```
User VTT → OpenAI Chat API → Translated VTT
```

**Scenario 2: Transcription + Translation**
```
User Audio → Whisper-1 (transcribe, VTT format) → VTT → Chat API → Translated VTT
          (preprocessing: audio→VTT)                    (main: translation)
```

**Scenario 3: Future - High-quality transcription** ⚠️ *Requires VTT conversion logic*
```
User Audio → GPT-4o Transcribe → JSON → [Convert to VTT] → Chat API → Translated VTT
          (gpt-4o-transcribe)         (not yet implemented) (main: translation)
```

**Note on Whisper Translation Endpoint:**
- The `/v1/audio/translations` endpoint only translates to English using Whisper (lower quality)
- For better translation quality, use transcription + GPT-4o Chat API
- We'll skip the translation endpoint and focus on transcription only

**Recommended Implementation:**
- Use `whisper-1` for transcription (audio → VTT in original language)
- Use Chat API (GPT-4o, GPT-4) for high-quality translation with full prompt customization


### Option A: Single Provider with Settings (Recommended)

**Structure:**
```typescript
Providers:
- Gemini
- OpenAI          ← Single provider
- Anthropic
- Ollama

OpenAI Settings:
□ Use Whisper API for transcription
  ├─ Mode: [Transcribe | Translate to English]
  └─ Language: [auto-detect | ja | ...]
```

**Workflow:**
1. User selects "OpenAI" as provider
2. User optionally enables Whisper transcription
3. If enabled: Audio → Whisper → VTT (preprocessing)
4. VTT → OpenAI Chat → Translated VTT (main task)

**Pros:**
- ✅ Matches mental model: "I'm using OpenAI"
- ✅ One API key, shared across features
- ✅ Clear that Whisper is a preprocessing option
- ✅ Can combine transcription + custom translation settings
- ✅ Simpler provider list (4 providers instead of 5+)
- ✅ Easy to add more OpenAI features (embeddings, function calling, etc.)

**Cons:**
- ⚠️ More complex internal logic (conditional capabilities)
- ⚠️ Settings affect multiple parts of UI

**Implementation Complexity:** Medium

---

### Option B: Separate Providers

**Structure:**
```typescript
Providers:
- Gemini
- OpenAI (Chat)        ← For translation
- OpenAI (Audio)       ← For audio → English
- Anthropic
- Ollama
```

**Workflow:**
1. User selects "OpenAI (Audio)" as provider
2. Audio → Whisper (translate) → English VTT → Done
3. OR: Audio → Whisper (transcribe) → Original VTT → OpenAI Chat → Translated VTT

**Pros:**
- ✅ Clean separation of concerns
- ✅ Simple capabilities (no conditionals)
- ✅ Clear purpose in provider dropdown

**Cons:**
- ❌ Same API key needed twice (confusing)
- ❌ "OpenAI (Audio)" can't translate to non-English (limited)
- ❌ Two-step process requires switching providers
- ❌ Provider list gets cluttered
- ❌ Not scalable (what about embeddings, DALL-E, etc.?)

**Implementation Complexity:** Higher (duplicate provider logic)

---

### Recommendation: Option A (Single Provider with Settings)

**Rationale:**

1. **Whisper is preprocessing, not a translation engine**
   - It generates VTT, which still needs translation (except for English-only mode)
   - Treating it as a separate provider misrepresents its role

2. **Shared authentication**
   - Same API key for all OpenAI features
   - Confusing to ask for the same key twice

3. **Scalability**
   - OpenAI has many APIs: Chat, Whisper, Embeddings, DALL-E, TTS, etc.
   - Creating separate providers for each is not sustainable
   - Better to have provider-specific features within one provider

4. **User mental model**
   - Users think "I'm using OpenAI" not "I'm using OpenAI Chat vs OpenAI Audio"
   - Features should be toggles, not provider choices

5. **Flexibility**
   - User can combine Whisper transcription with custom translation prompts
   - Can't do this if they're separate providers

### Implementation Strategy

```typescript
// providers/types.ts
export type ProviderCapabilities = {
  // Base capabilities
  supportsMediaUpload: boolean;
  supportsVision: boolean;
  supportsTemperature: boolean;
  supportsSafetySettings: boolean;
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  
  // Feature flags (can be toggled via settings)
  canTranscribeAudio?: boolean;  // Has transcription API
  canTranslateAudio?: boolean;   // Has audio→English API
};

export type OpenAIConfig = {
  // Audio transcription settings
  transcriptionEnabled: boolean;
  transcriptionModel?: 'whisper-1';  // Future: 'gpt-4o-transcribe' etc.
  transcriptionLanguage?: string;    // ISO-639-1 code, e.g., 'ja'
  
  // Future: embeddings, function calling, etc.
};
```

```typescript
// providers/OpenAIProvider.ts
export class OpenAIProvider extends BaseProvider {
  readonly capabilities: ProviderCapabilities = {
    supportsMediaUpload: false,      // Not for translation
    supportsVision: true,
    supportsTemperature: true,
    supportsSafetySettings: false,
    requiresApiKey: true,
    supportsStreaming: false,
    
    // Feature flags
    canTranscribeAudio: true,        // Can use Whisper
    canTranslateAudio: true,         // Can use Whisper translate
  };
  
  // Main translation method (existing)
  async generateContent(request: GenerateRequest): Promise<GenerateResponse> {
    // Uses /v1/chat/completions
  }
  
  // NEW: Transcription method
  async transcribeAudio(
    file: File, 
    mode: 'transcribe' | 'translate',
    language?: string
  ): Promise<string> {
    const endpoint = mode === 'translate' 
      ? '/v1/audio/translations'
      : '/v1/audio/transcriptions';
    
    // Returns VTT format
  }
}
```

---

## Part 3: Provider-Specific Settings UI

### Component Structure

```
src/components/
└── providers/
    ├── ProviderSpecificSettings.tsx    # Router component
    ├── GeminiAdvancedSettings.tsx      # Gemini-specific UI
    ├── OpenAIAdvancedSettings.tsx      # OpenAI-specific UI
    └── OllamaAdvancedSettings.tsx      # Ollama-specific UI
```

### Router Component

```typescript
// components/providers/ProviderSpecificSettings.tsx
export function ProviderSpecificSettings({ 
  provider, 
  config, 
  onChange,
  locked 
}: Props) {
  switch (provider) {
    case 'openai':
      return <OpenAIAdvancedSettings {...props} />;
    case 'gemini':
      return <GeminiAdvancedSettings {...props} />;
    case 'ollama':
      return <OllamaAdvancedSettings {...props} />;
    case 'anthropic':
      return null; // No specific settings yet
    default:
      return null;
  }
}
```

### OpenAI Specific Settings

```typescript
// components/providers/OpenAIAdvancedSettings.tsx
export function OpenAIAdvancedSettings({ config, onChange, locked }) {
  const theme = useTheme();
  
  return (
    <div className="space-y-4 mt-4 pt-4 border-t">
      <h4 className="font-semibold text-sm">OpenAI Audio Features</h4>
      
      {/* Audio Transcription */}
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.transcriptionEnabled}
          onChange={(e) => onChange({ 
            ...config, 
            transcriptionEnabled: e.target.checked 
          })}
          disabled={locked}
        />
        <span>Use Audio API for transcription</span>
      </label>
      <p className={theme.helperText}>
        Upload audio/video to generate VTT subtitles, then translate with Chat API.
      </p>
      
      {config.transcriptionEnabled && (
        <div className="ml-6 space-y-3">
          {/* Model selector */}
          <div className="space-y-2">
            <FieldLabel>Transcription Model</FieldLabel>
            <select
              className={theme.input}
              value={config.transcriptionModel || 'whisper-1'}
              onChange={(e) => onChange({ 
                ...config, 
                transcriptionModel: e.target.value 
              })}
              disabled={locked}
            >
              <option value="whisper-1">whisper-1 (VTT output)</option>
              {/* Future: GPT-4o models when VTT conversion is implemented */}
            </select>
            <p className={theme.helperText}>
              whisper-1 is currently the only model that outputs VTT format directly.
            </p>
          </div>
          
          {/* Language hint (optional) */}
          <div className="space-y-2">
            <FieldLabel>Source Language (optional)</FieldLabel>
            <input
              type="text"
              className={theme.input}
              value={config.transcriptionLanguage || ''}
              onChange={(e) => onChange({ 
                ...config, 
                transcriptionLanguage: e.target.value 
              })}
              placeholder="e.g., ja for Japanese"
              disabled={locked}
            />
            <p className={theme.helperText}>
              ISO-639-1 code. Leave empty for auto-detection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Integration into Main UI

```typescript
// App.tsx or ProviderSettings.tsx
<SectionCard title="API Provider Settings">
  {/* Common settings */}
  <div className="space-y-4">
    <FieldLabel>Provider</FieldLabel>
    <select value={selectedProvider} onChange={...}>
      <option value="gemini">Google Gemini</option>
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic Claude</option>
      <option value="ollama">Ollama (Local)</option>
    </select>
    
    {/* API Key, Model, Temperature */}
    {/* ... */}
  </div>
  
  {/* Provider-specific settings */}
  <ProviderSpecificSettings
    provider={selectedProvider}
    config={providerConfigs[selectedProvider]}
    onChange={(newConfig) => updateProviderConfig(selectedProvider, newConfig)}
    locked={locked}
  />
</SectionCard>
```

---

### Transcription Preview Box (Recommended)

When OpenAI transcription is enabled, show a **transcription preview** area that gives users visibility into the process:

**Benefits:**
- ✅ Users can review transcription quality before translating
- ✅ Clear separation between transcription and translation steps
- ✅ Can manually edit transcription if needed
- ✅ Provides feedback during async transcription process

**UI Flow:**

```
┌────────────────────────────────────────────┐
│ File Upload                                │
│                                            │
│ 📄 Subtitle File (VTT/SRT)                 │
│    [No file selected]                      │
│                                            │
│ 🎤 Audio File (Transcription)              │
│    [audio.mp3] (5.2 MB)                    │
│                                            │
│    [Transcribe Audio]  ← Button            │
│                                            │
│    ┌────────────────────────────────────┐ │
│    │ Transcription Preview              │ │
│    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│    │ WEBVTT                             │ │
│    │                                    │ │
│    │ 00:00:00.000 --> 00:00:03.500      │ │
│    │ こんにちは、皆さん                │ │
│    │                                    │ │
│    │ 00:00:03.500 --> 00:00:06.200      │ │
│    │ 今日は面白い話をします              │ │
│    │                                    │ │
│    │ [✓] Use this transcription         │ │
│    └────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// State for transcription
const [transcriptionText, setTranscriptionText] = useState('');
const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
const [useTranscription, setUseTranscription] = useState(false);

// Transcribe handler
const handleTranscribeAudio = async () => {
  if (!audioFile) return;
  
  try {
    setTranscriptionStatus('loading');
    
    const provider = ProviderFactory.create('openai', {
      apiKey,
      modelName,
    }) as OpenAIProvider;
    
    const vttContent = await provider.transcribeAudio(
      audioFile,
      providerConfigs.openai.transcriptionModel || 'whisper-1',
      providerConfigs.openai.transcriptionLanguage
    );
    
    setTranscriptionText(vttContent);
    setTranscriptionStatus('success');
    setUseTranscription(true); // Auto-enable
  } catch (err) {
    setTranscriptionStatus('error');
    setError(`Transcription failed: ${err.message}`);
  }
};

// In FileUploader component
{showAudioUpload && (
  <div className="space-y-3">
    <FieldLabel>🎤 Audio File (Transcription)</FieldLabel>
    <input type="file" accept="audio/*,video/*" onChange={handleAudioUpload} />
    
    {audioFile && (
      <Button
        type="button"
        tone="upload"
        onClick={handleTranscribeAudio}
        disabled={transcriptionStatus === 'loading' || locked}
      >
        {transcriptionStatus === 'loading' ? 'Transcribing...' : 'Transcribe Audio'}
      </Button>
    )}
    
    {/* Transcription Preview */}
    {transcriptionText && (
      <div className="mt-3 space-y-2">
        <FieldLabel>Transcription Preview</FieldLabel>
        <TextArea
          variant="code"
          className="h-48"
          value={transcriptionText}
          onChange={(e) => setTranscriptionText(e.target.value)}
          disabled={locked}
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useTranscription}
            onChange={(e) => setUseTranscription(e.target.checked)}
            disabled={locked}
          />
          <span>Use this transcription for translation</span>
        </label>
        <p className={theme.helperText}>
          ✓ Transcription complete. Edit if needed, then start translation below.
        </p>
      </div>
    )}
  </div>
)}
```

**Validation:**

```typescript
const canStartTranslation = useMemo(() => {
  // Must have EITHER:
  // 1. VTT file uploaded, OR
  // 2. Transcription generated and enabled
  const hasInput = Boolean(
    vttFile || 
    (useTranscription && transcriptionText)
  );
  
  const hasApiKey = !effectiveCapabilities.requiresApiKey || Boolean(apiKey);
  const notRunning = !submitting && !isRunning;
  
  return hasInput && hasApiKey && notRunning;
}, [vttFile, useTranscription, transcriptionText, effectiveCapabilities, apiKey, submitting, isRunning]);

// When starting translation
const handleStartTranslation = async () => {
  let finalVttFile: File;
  
  if (useTranscription && transcriptionText) {
    // Use transcription as VTT
    const blob = new Blob([transcriptionText], { type: 'text/vtt' });
    finalVttFile = new File([blob], 'transcription.vtt', { type: 'text/vtt' });
  } else if (vttFile) {
    // Use uploaded VTT
    finalVttFile = vttFile;
  } else {
    setError('Please provide either a VTT file or generate a transcription');
    return;
  }
  
  await startTranslation(finalVttFile);
};
```

**Alternative: Automatic Flow**

For a more streamlined UX, auto-transcribe on audio upload:

```typescript
const handleAudioUpload = async (file: File) => {
  setAudioFile(file);
  
  // Auto-transcribe if enabled
  if (providerConfigs.openai.transcriptionEnabled) {
    await handleTranscribeAudio(file);
  }
};
```

This removes the manual "Transcribe" button but gives less user control.

**Recommendation: Manual trigger** (separate button) because:
- ✅ Users can review settings before transcribing
- ✅ Avoids unexpected API calls
- ✅ Clear when costs are incurred
- ✅ Can re-transcribe with different settings if needed

---


## Part 4: State Management

### Centralized Provider Configurations

```typescript
// State structure
type ProviderConfigs = {
  gemini: {
    safetyOff: boolean;
    mediaResolution: 'low' | 'standard';
  };
  openai: {
    transcriptionEnabled: boolean;
    transcriptionModel?: 'whisper-1';
    transcriptionLanguage?: string;
  };
  anthropic: {
    // Future settings
  };
  ollama: {
    baseUrl: string;
  };
};

// In App.tsx or custom hook
const [providerConfigs, setProviderConfigs] = useState<ProviderConfigs>({
  gemini: { 
    safetyOff: false, 
    mediaResolution: 'low' 
  },
  openai: { 
    transcriptionEnabled: false,
    transcriptionModel: 'whisper-1',
    transcriptionLanguage: '' 
  },
  anthropic: {},
  ollama: { 
    baseUrl: 'http://localhost:11434' 
  },
});

// Helper to update specific provider config
const updateProviderConfig = <P extends ProviderType>(
  provider: P,
  updates: Partial<ProviderConfigs[P]>
) => {
  setProviderConfigs(prev => ({
    ...prev,
    [provider]: { ...prev[provider], ...updates }
  }));
};
```

### Persistence

```typescript
// Save to localStorage
useEffect(() => {
  localStorage.setItem('providerConfigs', JSON.stringify(providerConfigs));
}, [providerConfigs]);

// Load from localStorage
useEffect(() => {
  const saved = localStorage.getItem('providerConfigs');
  if (saved) {
    setProviderConfigs(JSON.parse(saved));
  }
}, []);
```

---

## Part 5: Validation and Error Handling

### Input Validation

```typescript
const validateInputs = () => {
  const errors: string[] = [];
  
  // Must have VTT OR media file (if transcription enabled)
  const hasVtt = Boolean(vttFile);
  const hasMedia = Boolean(mediaFile);
  const transcriptionEnabled = 
    selectedProvider === 'openai' && 
    providerConfigs.openai.transcriptionEnabled;
  
  if (!hasVtt && !hasMedia) {
    errors.push('Please provide either a subtitle file or audio file.');
  }
  
  if (hasMedia && !transcriptionEnabled && selectedProvider === 'openai') {
    errors.push('Media upload requires Whisper API. Enable it in provider settings.');
  }
  
  // API key required
  if (effectiveCapabilities.requiresApiKey && !apiKey) {
    errors.push(`${providerLabels[selectedProvider]} API key is required.`);
  }
  
  return errors;
};
```

### Start Translation Logic

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  
  const errors = validateInputs();
  if (errors.length > 0) {
    setError(errors.join(' '));
    return;
  }
  
  let finalVttFile = vttFile;
  
  // Preprocessing: Transcribe audio if needed
  if (mediaFile && effectiveCapabilities.mediaUploadPurpose === 'transcription') {
    try {
      setTranscriptionStatus('loading');
      
      const provider = ProviderFactory.create('openai', {
        apiKey,
        modelName,
      }) as OpenAIProvider;
      
      const vttContent = await provider.transcribeAudio(
        mediaFile,
        providerConfigs.openai.transcriptionMode,
        providerConfigs.openai.transcriptionLanguage
      );
      
      // Create VTT file from transcription
      const blob = new Blob([vttContent], { type: 'text/vtt' });
      finalVttFile = new File([blob], 'transcription.vtt', { type: 'text/vtt' });
      
      setTranscriptionStatus('success');
    } catch (err) {
      setTranscriptionStatus('error');
      setError(`Transcription failed: ${err.message}`);
      return;
    }
  }
  
  // Main translation workflow
  await startTranslation(finalVttFile);
};
```

---

## Summary

### Architectural Decisions

1. **Dynamic UI based on effective capabilities**
   - Compute capabilities from provider + settings
   - Show/hide UI elements conditionally
   - Use clear messaging when features unavailable

2. **Single provider with feature toggles**
   - One "OpenAI" provider (not separate Chat/Audio)
   - Audio API for transcription only (not translation)
   - Keeps provider list clean and scalable

3. **Transcription preview box**
   - Visible transcription step with editable preview
   - Manual "Transcribe" button for user control
   - Checkbox to enable/disable using transcription
   - Clear separation: transcription → review → translation

4. **Provider-specific settings components**
   - Each provider can have custom UI
   - Rendered conditionally in main settings section
   - Shared state management pattern

### Key Design Choices

**Why transcription-only (not translation)?**
- ✅ Whisper `/translations` endpoint only outputs English (inflexible)
- ✅ Lower quality than GPT-4o/GPT-4 for translation
- ✅ Can't use custom prompts, glossary, or summary with Whisper translation
- ✅ Better workflow: Transcribe (Whisper) → Translate (GPT-4o with full features)

**Why transcription preview box?**
- ✅ Users verify transcription quality before expensive translation
- ✅ Can manually edit transcription errors (names, technical terms, etc.)
- ✅ Clear feedback during async operations
- ✅ Separates concerns: transcription vs translation

**Why manual trigger (not auto-transcribe)?**
- ✅ Users control when API calls happen (cost visibility)
- ✅ Can review/adjust settings before transcribing
- ✅ Can re-transcribe with different settings if needed
- ✅ Prevents unexpected charges

### Benefits

✅ Clean separation between skeleton and provider-specific UI  
✅ Type-safe and maintainable  
✅ Easy to add new providers  
✅ Easy to add new features within providers (e.g., future GPT-4o transcription)  
✅ User-friendly with clear messaging  
✅ No code duplication  
✅ Transparent workflow with user control at each step

### Next Steps

1. Implement effective capabilities computation
2. Refactor FileUploader to support audio upload (OpenAI only)
3. Add transcription preview box to FileUploader
4. Create OpenAI advanced settings component
5. Implement `transcribeAudio()` method in OpenAIProvider
6. Update state management for provider configs
7. Add validation logic (VTT OR transcription required)
8. Test transcription → translation workflow
