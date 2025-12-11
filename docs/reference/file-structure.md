# File Structure Reference

Quick reference for finding code in the repository.

## Configuration

- **Defaults**: `src/config/defaults.ts`
- **Transcription defaults**: `src/config/transcriptionDefaults.ts`
- **UI config**: `src/config/ui.ts`

## Core Libraries

### Provider Abstraction
- **Factory**: `src/lib/providers/ProviderFactory.ts`
- **Base class**: `src/lib/providers/BaseProvider.ts`
- **Gemini**: `src/lib/providers/GeminiProvider.ts`
- **OpenAI**: `src/lib/providers/OpenAIProvider.ts`
- **Anthropic**: `src/lib/providers/AnthropicProvider.ts`
- **Ollama**: `src/lib/providers/OllamaProvider.ts`

### Translation & Processing
- **Translation logic**: `src/lib/translation.ts`
- **VTT parsing**: `src/lib/vtt.ts`
- **Validation**: `src/lib/validator.ts`
- **Chunking**: `src/lib/chunker.ts`
- **Stitching**: `src/lib/stitcher.ts`

### Utilities
- **Prompts**: `src/lib/prompts.ts`
- **Logging**: `src/lib/providerLog.ts`
- **Media upload**: `src/lib/mediaUpload.ts`
- **Rate limiting**: `src/lib/rateLimit.ts`
- **Preferences**: `src/lib/prefs.ts`
- **Session save/load**: `src/lib/transcriptionSession.ts`

## Features

### Translation
- **Root**: `src/features/translation/`
- **Hooks**: `src/features/translation/hooks/`
- **Components**: `src/features/translation/components/`

### Transcription
- **Root**: `src/features/transcription/`
- **Hooks**: `src/features/transcription/hooks/`
- **Components**: `src/features/transcription/components/`
- **Gemini implementation**: `src/features/transcription/lib/gemini.ts`
- **OpenAI implementation**: `src/features/transcription/lib/openai.ts`

## Structured Output (Experimental)

- **Schema**: `src/lib/structured/TranscriptionStructuredOutput.ts`
- **Prompt builder**: `src/lib/structured/TranscriptionStructuredPrompt.ts`
- **VTT reconstruction**: `src/lib/structured/TranscriptionVttReconstructor.ts`
- **Gemini implementation**: `src/features/transcription/lib/gemini-structured.ts`

## State Management

- **Main runner**: `src/hooks/useTranslationWorkflowRunner.ts`
- **Translation runner**: `src/hooks/useTranslationRunner.ts`
- **Provider state**: `src/hooks/useProviderState.ts`
- **Prompt state**: `src/hooks/usePromptState.ts`
- **File state**: `src/hooks/useFileState.ts`

## UI Components

### App-Level
- **Main app**: `src/App.tsx`
- **File uploader**: `src/components/FileUploader.tsx`
- **Provider settings**: `src/components/ProviderSettings.tsx`

### Translation-Specific
- **Progress**: `src/features/translation/components/TranslationProgress.tsx`
- **Results**: `src/features/translation/components/ResultView.tsx`
- **VTT editor**: `src/features/translation/components/VttEditModal.tsx`

### Transcription-Specific
- **Progress**: `src/features/transcription/components/TranscriptionProgress.tsx`
- **Results**: `src/features/transcription/components/TranscriptionResultView.tsx`
- **Settings**: `src/features/transcription/components/TranscriptionSettings.tsx`

## Scripts

- **Structured transcription test**: `scripts/test-structured-transcription.ts`
- **Translation test**: `scripts/test-structured-translation.ts`
- **VTT converter**: `scripts/convert-to-vtt.ts`
- **Alignment scripts**: `scripts/align-by-time.ts`, `scripts/align-transcriptions.ts`

## Tests

- **Lib tests**: `src/lib/__tests__/`
- **Hook tests**: `src/hooks/__tests__/`
- **Component tests**: (colocated with components)

## Build & Config

- **Vite config**: `vite.config.ts`
- **TypeScript**: `tsconfig.json`
- **ESLint**: `eslint.config.js`
- **Tailwind**: `tailwind.config.cjs`
- **PostCSS**: `postcss.config.cjs`
