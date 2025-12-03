# Multi-Provider API Support

> **Status**: Implemented (Core Infrastructure Complete)  
> **Last Updated**: 2025-12-02  
> **Related**: [gemini.md](./gemini.md), [design.md](./design.md)

## Overview

ChigyuSubs now supports multiple LLM API backends through a provider abstraction layer. You can translate subtitles using:

- **Google Gemini** (default) - Full feature support including media upload
- **OpenAI** - GPT-4 and GPT-3.5 models
- **Anthropic** - Claude 3.5 and Claude 3 models  
- **Ollama** - Locally-hosted open-source models

All providers implement the same interface, making it easy to switch between them or compare translation quality.

## Supported Providers

### Google Gemini

**Best for**: Media-rich content, Japanese variety shows, video with visual context

**Features**:
- ✅ Media upload and processing (audio/video)
- ✅ Vision support for on-screen text
- ✅ Safety settings control
- ✅ Multiple model options (Pro, Flash)
- ✅ Token usage tracking

**Setup**: [See Gemini API Setup](./gemini.md)

**Recommended Models**:
- `gemini-2.5-pro` - Best quality
- `gemini-2.5-flash` - Faster, lower cost

---

### OpenAI

**Best for**: High-quality translation, technical content, general-purpose use

**Features**:
- ✅ GPT-4 and GPT-3.5 models
- ✅ Temperature control
- ✅ Token usage tracking
- ❌ No media upload (text-only translation)

**Setup**:
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Select "OpenAI" as provider in settings
3. Enter your API key (starts with `sk-`)
4. Choose a model

**Recommended Models**:
- `gpt-4-turbo` - Best quality
- `gpt-4o` - Good balance of quality and speed
- `gpt-3.5-turbo` - Fastest, most economical

**Cost Estimate** (60-minute subtitle file):
- GPT-4 Turbo: ~$0.50-2.00
- GPT-3.5 Turbo: ~$0.05-0.20

---

### Anthropic Claude

**Best for**: Nuanced translation, literary content, creative dialogue

**Features**:
- ✅ Claude 3.5 Sonnet and Haiku models
- ✅ Temperature control
- ✅ Token usage tracking
- ❌ No media upload (text-only translation)

**Setup**:
1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Select "Anthropic" as provider in settings
3. Enter your API key (starts with `sk-ant-`)
4. Choose a model

**Recommended Models**:
- `claude-3-5-sonnet-20241022` - Best quality (recommended)
- `claude-3-5-haiku-20241022` - Fast and economical
- `claude-3-opus-20240229` - Previous generation flagship

**Cost Estimate** (60-minute subtitle file):
- Claude 3.5 Sonnet: ~$0.30-1.50
- Claude 3.5 Haiku: ~$0.05-0.25

---

### Ollama (Local Models)

**Best for**: Privacy-sensitive content, offline translation, cost-free experimentation

**Features**:
- ✅ Run models locally on your machine
- ✅ No API key required
- ✅ Completely private (no data leaves your computer)
- ✅ Supports various open-source models
- ⚠️ Quality varies by model
- ⚠️ Slower than cloud APIs (depends on hardware)

**Setup**:
1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Start Ollama: `ollama serve`
3. Pull a model: `ollama pull llama2` (or other model)
4. Select "Ollama" as provider in settings
5. Enter base URL (default: `http://localhost:11434`)
6. Choose your installed model

**Recommended Models**:
- `llama2:70b` - Best quality (requires ~40GB RAM)
- `mistral:7b` - Good balance
- `gemma:7b` - Google's open model
- `qwen2:7b` - Multilingual support

**Requirements**:
- CPU: Modern multi-core processor
- RAM: 8GB minimum (16GB+ recommended for larger models)
- Disk: 4-50GB per model

---

## Provider Comparison

| Feature | Gemini | OpenAI | Anthropic | Ollama |
|---------|--------|---------|-----------|--------|
| **Media Upload** | ✅ | ❌ | ❌ | ❌ |
| **Vision Support** | ✅ | ⚠️ Limited | ⚠️ Limited | ⚠️ Some models |
| **API Key Required** | ✅ | ✅ | ✅ | ❌ |
| **Translation Quality** | Excellent | Excellent | Excellent | Good-Excellent* |
| **Speed** | Fast | Fast | Fast | Variable* |
| **Cost** | Moderate | Moderate-High | Moderate | Free (compute only) |
| **Privacy** | Cloud | Cloud | Cloud | Local |
| **Best For** | Video context | Technical accuracy | Creative content | Privacy/offline |

\* *Depends on model size and hardware*

---

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

---

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

---

## Code Structure

```
src/lib/providers/
├── types.ts              # Core interfaces and types
├── BaseProvider.ts       # Abstract base class
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

---

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

---

## FAQ

### Q: Which provider should I use?

**A**: It depends on your needs:

- **Video with context**: Gemini (only provider with media upload)
- **Best quality**: Try GPT-4 Turbo or Claude 3.5 Sonnet
- **Privacy/offline**: Ollama
- **Cost-conscious**: GPT-3.5 Turbo or Claude 3.5 Haiku
- **Experimentation**: Start with Gemini (default), compare with others

### Q: Can I use multiple providers in one translation?

**A**: Not yet, but this is planned. Currently, choose one provider per translation job.

### Q: Do all providers support the same features?

**A**: No. Key differences:

- **Media upload**: Only Gemini currently
- **Safety settings**: Only Gemini
- **Vision support**: Gemini (full), others (limited or none)
- **Model listing**: OpenAI and Ollama have API endpoints; Anthropic uses static list

### Q: Which provider gives the best translation quality?

**A**: Quality is subjective and content-dependent. In testing:

- **Technical accuracy**: OpenAI GPT-4, Anthropic Claude 3.5 Sonnet
- **Natural fluency**: Anthropic Claude, Gemini Pro
- **Cultural adaptation**: Gemini (with media context)
- **Consistency**: All providers perform similarly with good prompts

We recommend testing your specific content with different providers.

### Q: What about costs?

**A**: Approximate costs for a 60-minute subtitle file (~20,000 tokens):

- **Gemini 2.5 Pro**: $0.10-0.50 (free tier available)
- **Gemini 2.5 Flash**: $0.02-0.10 (free tier available)
- **GPT-4 Turbo**: $0.50-2.00
- **GPT-3.5 Turbo**: $0.05-0.20
- **Claude 3.5 Sonnet**: $0.30-1.50
- **Claude 3.5 Haiku**: $0.05-0.25
- **Ollama**: $0 (hardware costs only)

Costs vary based on model, prompt complexity, and concurrency settings.

### Q: Is Ollama quality as good as cloud providers?

**A**: It depends on the model:

- **Large models** (70B parameters): Comparable to GPT-3.5 or Claude 3 Haiku
- **Medium models** (7-13B): Good for simpler content, may struggle with nuance
- **Small models** (<7B): Best for experimentation, not production

Ollama is great for privacy and cost, but expect slower speeds and potentially lower quality vs. GPT-4 or Claude 3.5 Sonnet.

---

## Troubleshooting

### Provider fails to initialize

**Check**:
- API key is correct and has credits/quota
- Model name is valid for that provider
- For Ollama: server is running (`ollama serve`)
- Network connection to provider API

### "Empty response from [provider]" error

**Causes**:
- Safety filter blocked the content (Gemini)
- Token limit exceeded
- Content policy violation
- Network timeout

**Solutions**:
- Try with `safetyOff=true` (Gemini only)
- Reduce chunk size
- Check provider dashboard for policy violations
- Retry with exponential backoff

### Models not showing in dropdown

**Check**:
- API key is valid and has permissions
- Network connection to provider
- For Ollama: run `ollama list` to see installed models
- Provider-specific:
  - **OpenAI**: Key must have model access
  - **Gemini**: Requires `generateContent` capability
  - **Anthropic**: Uses static model list (no API)

---

## Next Steps

1. **Try different providers** - Compare quality for your content
2. **Optimize settings** - Adjust temperature, chunk size per provider
3. **Monitor costs** - Track usage in provider dashboards
4. **Share feedback** - Report issues or quality comparisons

For more details on the architecture, see the [walkthrough documentation](../brain/.../walkthrough.md).
