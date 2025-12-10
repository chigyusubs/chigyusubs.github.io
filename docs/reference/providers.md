# Multi-Provider Support

ChigyuSubs supports multiple LLM API backends through a provider abstraction layer. Choose the provider that best fits your needs.

## Provider Comparison

| Feature | Gemini | OpenAI | Anthropic | Ollama |
|---------|--------|---------|-----------|--------|
| **Media Upload (transcription)** | ✅ (required for transcription) | ❌ | ❌ | ❌ |
| **Vision Support** | ✅ | ⚠️ Limited | ⚠️ Limited | ⚠️ Some models |
| **API Key Required** | ✅ | ✅ | ✅ | ❌ |
| **Translation Quality** | Excellent | Excellent | Excellent | Good-Excellent* |
| **Speed** | Fast | Fast | Fast | Variable* |
| **Cost** | Moderate | Moderate-High | Moderate | Free (compute only) |
| **Privacy** | Cloud | Cloud | Cloud | Local |
| **Best For** | Video context | Technical accuracy | Creative content | Privacy/offline |

\* *Depends on model size and hardware*

## Provider Guides

Choose a provider and follow the setup guide:

- **[Gemini](./providers/gemini.md)** - Google's multimodal AI (default, recommended for comedy with visual context)
- **[OpenAI](./providers/openai.md)** - GPT-4 and GPT-3.5 models (high-quality translation)
- **[Anthropic](./providers/anthropic.md)** - Claude 3.5 models (nuanced translation, creative content)
- **[Ollama](./providers/ollama.md)** - Local models (privacy-first, offline, cost-free)

## Quick Recommendations

### I need to see video/on-screen text / transcription
→ **Use Gemini** (only provider with media upload/vision; transcription is Gemini-only)

### I want best translation quality for dialogue
→ **Try GPT-4 Turbo or Claude 3.5 Sonnet**

### I have sensitive/private content
→ **Use Ollama** (runs locally, no data leaves your computer)

### I want the cheapest option
→ **Gemini 2.5 Flash** (generous free tier) or **Ollama** (free, hardware costs only)

### I want to experiment and compare
→ **Start with Gemini** (default), then try others on the same content

## Cost Comparison

Approximate costs for a typical 60-minute subtitle file (~20,000 tokens):

| Provider | Model | Cost |
|----------|-------|------|
| **Gemini** | 2.5 Pro | $0.10-0.50 |
| **Gemini** | 2.5 Flash | $0.02-0.10 |
| **OpenAI** | GPT-4 Turbo | $0.50-2.00 |
| **OpenAI** | GPT-3.5 Turbo | $0.05-0.20 |
| **Anthropic** | Claude 3.5 Sonnet | $0.30-1.50 |
| **Anthropic** | Claude 3.5 Haiku | $0.05-0.25 |
| **Ollama** | Local models | $0 (compute only) |

See [Tokenomics](./reference/tokenomics.md) for detailed cost analysis.

## FAQ

### Q: Which provider should I use?

**A**: It depends on your needs:

- **Video with context / transcription**: Gemini (only provider with media upload; transcription is Gemini-only)
- **Best quality**: Try GPT-4 Turbo or Claude 3.5 Sonnet
- **Privacy/offline**: Ollama
- **Cost-conscious**: GPT-3.5 Turbo or Claude 3.5 Haiku
- **Experimentation**: Start with Gemini (default), compare with others

### Q: Can I use multiple providers in one translation?

**A**: Not yet, but this is planned. Currently, choose one provider per translation job.

### Q: Do all providers support the same features?

**A**: No. Key differences:

- **Media upload / transcription**: Only Gemini currently (transcription is Gemini-only in the UI)
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

### Q: How are API keys handled?

**A**: Keys are never persisted by the app. They live only in memory for the open tab. Use your browser’s password manager if you want to save per-provider keys.

### Q: Is Ollama quality as good as cloud providers?

**A**: It depends on the model:

- **Large models** (70B parameters): Comparable to GPT-3.5 or Claude 3 Haiku
- **Medium models** (7-13B): Good for simpler content, may struggle with nuance
- **Small models** (<7B): Best for experimentation, not production

Ollama is great for privacy and cost, but expect slower speeds and potentially lower quality vs. GPT-4 or Claude 3.5 Sonnet.
