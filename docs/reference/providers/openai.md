# OpenAI Provider Setup

> **Best for**: High-quality translation, technical content, general-purpose use

## Features

- ✅ GPT-4 and GPT-3.5 models
- ✅ Temperature control
- ✅ Token usage tracking
- ❌ No media upload (text-only translation)

## Setup

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Select "OpenAI" as provider in ChigyuSubs settings
3. Enter your API key (starts with `sk-`)
4. Choose a model

## Recommended Models

- **`gpt-4-turbo`** - Best quality, latest GPT-4 with 128K context
- **`gpt-4o`** - Good balance of quality and speed
- **`gpt-3.5-turbo`** - Fastest, most economical

## Cost Estimates

For a typical 60-minute subtitle file (~20,000 tokens):

- **GPT-4 Turbo**: ~$0.50-2.00
- **GPT-4o**: ~$0.30-1.00
- **GPT-3.5 Turbo**: ~$0.05-0.20

Costs vary based on prompt complexity and concurrency settings.

## When to Use OpenAI

**Choose OpenAI if you need**:
- High technical accuracy
- Reliable, consistent quality
- Fast processing speeds
- Well-documented API

**Don't choose OpenAI if you need**:
- Media/video context (use Gemini instead)
- Privacy/offline processing (use Ollama instead)
- Free tier (Gemini has generous free limits)

## Limitations

- **No media upload**: Cannot see video or hear audio - translation is text-only
- **No vision support**: Cannot read on-screen text or visual context
- **Requires credits**: Need to add payment method, no free tier

## Troubleshooting

### "Invalid API key" error

- Verify key starts with `sk-` and is copied correctly
- Check key has sufficient credits at [platform.openai.com](https://platform.openai.com/usage)
- Ensure key hasn't been revoked

### "Model not found" error

- Verify model name is correct (e.g., `gpt-4-turbo`, not `gpt-4-turbo-preview`)
- Check your account has access to that model
- Some models require waitlist approval

### Slow responses

- OpenAI occasionally has high demand
- Try reducing concurrency (Settings → Concurrency = 2-3)
- Check [OpenAI Status](https://status.openai.com/)

