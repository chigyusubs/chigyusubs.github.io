# Provider Abstraction Layer

> **Status**: Implemented (Core Infrastructure Complete)
> **Last Updated**: 2025-12-02

## Overview

ChigyuSubs uses a provider abstraction layer to support multiple LLM API backends. All providers implement the same interface, making it easy to switch between them or add new ones.

## Architecture

### Provider Interface

All providers implement the `TranslationProvider` interface:

```typescript
interface TranslationProvider {
  // Generate translated content
  generateContent(request: GenerateRequest): Promise<GenerateResponse>;

  // List available models
  listModels(): Promise<ModelInfo[]>;

  // Get provider capabilities
  getProviderInfo(): ProviderInfo;

  // Validate configuration
  validateConfig(config: ProviderConfig): boolean;

  // Optional: Upload media (Gemini only currently)
  uploadMedia?(file: File): Promise<MediaReference>;
  deleteMedia?(reference: string): Promise<void>;
}
```

### Provider Factory

Create providers using the factory pattern:

```typescript
import { ProviderFactory } from "./lib/providers";

// Create a provider
const provider = ProviderFactory.create("openai", {
  apiKey: "sk-...",
  modelName: "gpt-4-turbo"
});

// Use it
const result = await provider.generateContent({
  systemPrompt: "Translate these subtitles...",
  userPrompt: "WEBVTT content...",
  temperature: 0.7
});

console.log(result.text); // Translated VTT
console.log(result.usage); // Token usage info
```

### Switching Providers

Switching between providers is seamless:

```typescript
// All providers use the same interface
const providers = {
  gemini: ProviderFactory.create("gemini", {
    apiKey: "AIza...",
    modelName: "gemini-2.5-pro"
  }),
  openai: ProviderFactory.create("openai", {
    apiKey: "sk-...",
    modelName: "gpt-4-turbo"
  }),
  anthropic: ProviderFactory.create("anthropic", {
    apiKey: "sk-ant-...",
    modelName: "claude-3-5-sonnet-20241022"
  })
};

// Try each provider with the same request
for (const [name, provider] of Object.entries(providers)) {
  const result = await provider.generateContent(request);
  console.log(`${name}: ${result.text.slice(0, 100)}...`);
}
```

## Code Structure

```
src/lib/providers/
├── types.ts              # Core interfaces and types
├── BaseProvider.ts       # Abstract base class with retry/rate limiting
├── ProviderFactory.ts    # Factory and utilities
├── GeminiProvider.ts     # Gemini implementation
├── OpenAIProvider.ts     # OpenAI implementation
├── AnthropicProvider.ts  # Anthropic implementation
├── OllamaProvider.ts     # Ollama implementation
└── index.ts             # Exports

src/lib/
├── gemini.ts            # Backward-compatible wrapper
├── providerLog.ts       # Multi-provider logging
└── translation.ts       # Translation orchestration
```

## Implementation Status

### ✅ Complete

- Provider abstraction layer (`TranslationProvider` interface)
- Base provider with retry logic and rate limiting
- Provider factory and registry
- Four provider implementations:
  - GeminiProvider (full feature parity)
  - OpenAIProvider
  - AnthropicProvider
  - OllamaProvider
- Unified logging system (`providerLog.ts`)
- Backward compatibility wrapper
- TypeScript compilation verified

### 🚧 In Progress

- UI integration for provider selection
- Per-provider configuration storage
- Provider-specific settings (e.g., Ollama base URL)
- Model selection dropdown with provider namespacing
- Debug log UI updates to show provider name

### 📋 Planned

- Provider comparison mode (translate with multiple providers)
- Provider-specific optimizations (prompt tuning per provider)
- Enhanced error messages for provider-specific issues
- Provider fallback (auto-retry with different provider on failure)

## Adding a New Provider

To add a new provider:

1. **Create provider class** extending `BaseProvider`:

   ```typescript
   // src/lib/providers/NewProvider.ts
   import { BaseProvider } from "./BaseProvider";
   import type { GenerateRequest, GenerateResponse } from "./types";

   export class NewProvider extends BaseProvider {
     async generateContent(request: GenerateRequest): Promise<GenerateResponse> {
       // 1. Build API request
       const apiRequest = this.buildRequest(request);

       // 2. Call API (with built-in retry/rate limiting)
       const response = await this.fetchWithRetry(
         "https://api.newprovider.com/v1/generate",
         {
           method: "POST",
           headers: {
             "Authorization": `Bearer ${this.config.apiKey}`,
             "Content-Type": "application/json"
           },
           body: JSON.stringify(apiRequest)
         }
       );

       // 3. Parse response
       const data = await response.json();

       return {
         text: data.output,
         usage: {
           promptTokens: data.usage.input_tokens,
           completionTokens: data.usage.output_tokens,
           totalTokens: data.usage.total_tokens
         }
       };
     }

     async listModels(): Promise<ModelInfo[]> {
       // Implement model listing
     }

     getProviderInfo(): ProviderInfo {
       return {
         name: "newprovider",
         displayName: "New Provider",
         supportsMediaUpload: false,
         supportsVision: false
       };
     }
   }
   ```

2. **Register in ProviderFactory**:

   ```typescript
   // src/lib/providers/ProviderFactory.ts
   import { NewProvider } from "./NewProvider";

   export class ProviderFactory {
     static create(type: string, config: ProviderConfig): TranslationProvider {
       switch (type) {
         case "newprovider":
           return new NewProvider(config);
         // ... other providers
       }
     }
   }
   ```

3. **Add UI integration** (in `src/components/ProviderSettings.tsx`)

4. **Add documentation** (in `docs/user/providers/newprovider.md`)

5. **Test thoroughly** with real API calls

## Migration Guide

### For Existing Users

**No action required!** The refactoring maintains full backward compatibility:

- Existing code using `gemini.ts` continues to work
- Preferences and settings are preserved
- Default provider is Gemini

### For Developers

If you're building features that use the API:

**Before**:
```typescript
import { translateChunkText } from "./lib/gemini";

const result = await translateChunkText({
  apiKey: "AIza...",
  modelName: "gemini-2.5-pro",
  systemPrompt: "...",
  userPrompt: "...",
  temperature: 0.7
});
```

**After**:
```typescript
import { ProviderFactory } from "./lib/providers";

const provider = ProviderFactory.create("gemini", {
  apiKey: "AIza...",
  modelName: "gemini-2.5-pro"
});

const result = await provider.generateContent({
  systemPrompt: "...",
  userPrompt: "...",
  temperature: 0.7
});
```

The old API still works via the compatibility wrapper, but new code should use the provider abstraction.

## Capabilities System

Providers declare their capabilities, which the UI uses to show/hide features:

```typescript
interface ProviderCapabilities {
  supportsMediaUpload: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsSafetySettings: boolean;
  maxConcurrency: number;
}
```

**Example**:
```typescript
// Gemini supports media upload
if (provider.getProviderInfo().supportsMediaUpload) {
  showMediaUploadButton();
}

// OpenAI doesn't - hide the button
```
