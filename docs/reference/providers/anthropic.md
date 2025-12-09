# Anthropic Provider Setup

> **Best for**: Nuanced translation, literary content, creative dialogue

## Features

- ✅ Claude 3.5 Sonnet and Haiku models
- ✅ Temperature control
- ✅ Token usage tracking
- ✅ Large context window (200K tokens)
- ❌ No media upload (text-only translation)

## Setup

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Select "Anthropic" as provider in ChigyuSubs settings
3. Enter your API key (starts with `sk-ant-`)
4. Choose a model

## Recommended Models

- **`claude-3-5-sonnet-20241022`** - Best quality (recommended)
- **`claude-3-5-haiku-20241022`** - Fast and economical
- **`claude-3-opus-20240229`** - Previous generation flagship

## Cost Estimates

For a typical 60-minute subtitle file (~20,000 tokens):

- **Claude 3.5 Sonnet**: ~$0.30-1.50
- **Claude 3.5 Haiku**: ~$0.05-0.25
- **Claude 3 Opus**: ~$1.50-3.00 (legacy)

Costs vary based on prompt complexity and concurrency settings.

## When to Use Anthropic

**Choose Anthropic if you need**:
- Natural, fluent translation
- Strong cultural adaptation
- Creative content (comedy, dialogue)
- Nuanced interpretation

**Don't choose Anthropic if you need**:
- Media/video context (use Gemini instead)
- Privacy/offline processing (use Ollama instead)
- Free tier (Gemini has generous free limits)

## Limitations

- **No media upload**: Cannot see video or hear audio - translation is text-only
- **No vision support**: Cannot read on-screen text or visual context
- **Requires credits**: Need to add payment method, no free tier
- **No model listing API**: Models are selected from a static list

## Troubleshooting

### "Invalid API key" error

- Verify key starts with `sk-ant-` and is copied correctly
- Check key has sufficient credits at [console.anthropic.com](https://console.anthropic.com/)
- Ensure key hasn't been revoked

### "Rate limit exceeded" error

- Anthropic has strict rate limits on free tier
- Reduce concurrency (Settings → Concurrency = 1-2)
- Wait a minute and retry
- Consider upgrading to paid tier

### "Overloaded" error

- Anthropic occasionally has high demand
- Retry after a few seconds (automatic retry is built-in)
- Try a different model (Haiku may be more available)

