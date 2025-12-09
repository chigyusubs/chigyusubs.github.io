# Tokenomics & Pricing Reference

> **Last Updated**: December 2024 (post rate-limit changes)  
> **Source**: [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)  
> **Note**: We validated our test scripts just before these limits took effect 🎽

## Quick Reference

### Models for Video Transcription

| Model | Free Tier | Paid Input (video) | Paid Output | Batch Discount |
|-------|-----------|-------------------|-------------|----------------|
| **gemini-3-pro-preview** | ❌ None | $2.00-4.00/1M | $12.00-18.00/1M | 50% off |
| **gemini-2.5-pro** | Limited | $1.25-2.50/1M | $10.00-15.00/1M | 50% off |
| **gemini-2.5-flash** | 5 RPM, 20 RPD | $0.30/1M | $2.50/1M | 50% off |
| **gemini-2.5-flash-lite** | 10 RPM, 20 RPD | $0.10/1M | $0.40/1M | 50% off |
| **gemini-2.0-flash** | Unlimited | $0.10/1M | $0.40/1M | 50% off |

*Pro models have higher pricing tiers for prompts >200k tokens*

### Free Tier Limits (New - Dec 2024)

> ⚠️ **Major change**: Free tier severely restricted. Video-capable models limited to ~40 RPD combined.

| Model | RPM | TPM | RPD | Notes |
|-------|-----|-----|-----|-------|
| gemini-3-pro-preview | 0 | 0 | 0 | No free tier |
| gemini-2.5-pro | 0 | 0 | 0 | No free tier |
| gemini-2.5-flash | 5 | 250k | 20 | Video capable |
| gemini-2.5-flash-lite | 10 | 250k | 20 | Video capable |
| gemini-2.0-flash | 0 | 0 | 0 | No free tier |
| **gemini-2.5-flash-live** | ∞ | 1M | ∞ | Live API only |
| **gemini-2.0-flash-live** | ∞ | - | ∞ | Live API only |
| gemma-3-27b | 30 | 15k | 14.4k | Text-only, local |

**Combined free video transcription: ~40 RPD** (20 flash + 20 flash-lite)

**RPM** = Requests Per Minute, **TPM** = Tokens Per Minute, **RPD** = Requests Per Day

### Live API Models (Unlimited Free)

The Live API models have unlimited free requests but are designed for real-time streaming:
- `gemini-2.5-flash-live`
- `gemini-2.0-flash-live`

**TODO**: Investigate if Live API can be used for batch video transcription.

### Gemma for Text-Only (Local/Free)

| Model | RPM | TPM | RPD | Use Case |
|-------|-----|-----|-----|----------|
| gemma-3-27b | 30 | 15k | 14.4k | Translation (text-only) |
| gemma-3-12b | 30 | 15k | 14.4k | Lighter translation |
| gemma-3-4b | 30 | 15k | 14.4k | Fast testing |

**Note**: Gemma models are text-only. Could be used for translation step to reduce costs.
Runs via same Gemini API or locally via Ollama.

---

## Cost Calculation

### Measured Token Usage (from our tests)

| Clip Length | Resolution | Input Tokens | Output Tokens |
|-------------|------------|-------------|---------------|
| 1 minute | 720p 5fps | ~18k | ~2.5k |
| 2 minutes | 720p 5fps | ~36k | ~3k |

### Per-Episode Cost Estimates

**Assumptions:**
- 46-minute episode
- 1-minute chunks (required for accuracy)
- ~46 transcription requests
- ~46 translation requests (text-only, much cheaper)

#### Using gemini-2.5-flash (Standard)

| Step | Requests | Input Tokens | Output Tokens | Cost |
|------|----------|-------------|---------------|------|
| Transcription | 46 | 46 × 18k = 828k | 46 × 2.5k = 115k | $0.25 + $0.29 = **$0.54** |
| Translation | 46 | ~100k (text) | ~100k | $0.03 + $0.25 = **$0.28** |
| **Total** | 92 | ~1M | ~215k | **~$0.82** |

#### Using gemini-2.5-flash-lite (Standard)

| Step | Requests | Input Tokens | Output Tokens | Cost |
|------|----------|-------------|---------------|------|
| Transcription | 46 | 828k | 115k | $0.08 + $0.05 = **$0.13** |
| Translation | 46 | ~100k | ~100k | $0.01 + $0.04 = **$0.05** |
| **Total** | 92 | ~1M | ~215k | **~$0.18** |

#### Using gemini-2.0-flash (Standard)

| Step | Requests | Input Tokens | Output Tokens | Cost |
|------|----------|-------------|---------------|------|
| Transcription | 46 | 828k | 115k | $0.08 + $0.05 = **$0.13** |
| Translation | 46 | ~100k | ~100k | $0.01 + $0.04 = **$0.05** |
| **Total** | 92 | ~1M | ~215k | **~$0.18** |

#### Using gemini-2.5-pro (Standard)

| Step | Requests | Input Tokens | Output Tokens | Cost |
|------|----------|-------------|---------------|------|
| Transcription | 46 | 828k | 115k | $1.04 + $1.15 = **$2.19** |
| Translation | 46 | ~100k | ~100k | $0.13 + $1.00 = **$1.13** |
| **Total** | 92 | ~1M | ~215k | **~$3.32** |

#### Using gemini-3-pro-preview (Standard)

| Step | Requests | Input Tokens | Output Tokens | Cost |
|------|----------|-------------|---------------|------|
| Transcription | 46 | 828k | 115k | $1.66 + $1.38 = **$3.04** |
| Translation | 46 | ~100k | ~100k | $0.20 + $1.20 = **$1.40** |
| **Total** | 92 | ~1M | ~215k | **~$4.44** |

#### With Batch API (50% discount)

| Model | Standard | Batch |
|-------|----------|-------|
| gemini-3-pro-preview | $4.44 | **$2.22** |
| gemini-2.5-pro | $3.32 | **$1.66** |
| gemini-2.5-flash | $0.82 | **$0.41** |
| gemini-2.5-flash-lite | $0.18 | **$0.09** |
| gemini-2.0-flash | $0.18 | **$0.09** |

---

## Free Tier Strategy

With 20 RPD limit on Flash models:
- **1 episode = ~92 requests** (46 transcription + 46 translation)
- **Free tier capacity: ~20-25% of one episode per day**
- **Full episode: ~4-5 days on free tier**

### Recommended Approach

1. **Development/Testing**: Use free tier (20 RPD) for iteration
2. **Production**: Pay-as-you-go ($0.09-$0.82 per episode)
3. **Batch processing**: Use Batch API for 50% savings when latency not critical

---

## Model Selection Guide

| Use Case | Recommended Model | Why |
|----------|-------------------|-----|  
| **Best quality** | gemini-3-pro-preview | Most capable, best reasoning |
| **Value + quality** | gemini-2.5-pro | Strong quality, reasonable cost |
| **Balanced** | gemini-2.5-flash | Good quality, lower cost |
| **Budget transcription** | gemini-2.5-flash-lite | 4x cheaper than flash |
| **Free translation** | gemma-3-27b | 14.4k RPD, text-only |
| **Free dev (limited)** | gemini-2.5-flash | 20 RPD for testing |

### Quality vs Cost Comparison

| Model | Quality | Speaker ID | Visual Notes | Cost/Episode (Batch) |
|-------|---------|------------|--------------|---------------------|
| gemini-3-pro-preview | ⭐⭐⭐⭐⭐ | Excellent | Rich | $2.22-4.44 |
| gemini-2.5-pro | ⭐⭐⭐⭐⭐ | Excellent | Rich | $1.66-3.32 |
| gemini-2.5-flash | ⭐⭐⭐⭐ | Good | Good | $0.41-0.82 |
| gemini-2.5-flash-lite | ⭐⭐⭐ | Good | Basic | $0.09-0.18 |
| gemma-3-27b | N/A | N/A | N/A | Free (translation only) |

---

## Context Caching (Future Optimization)

For repeated transcription of same show format:

| Model | Cache Price | Storage/hour |
|-------|-------------|--------------|
| gemini-2.5-flash | $0.03/1M | $1.00/1M/hr |
| gemini-2.0-flash | $0.025/1M | $1.00/1M/hr |

Could reduce costs for batched multi-episode processing by caching prompt/format context.

---

## Translation-Only Costs

If using Whisper for transcription (free, local), only pay for translation:

| Model | 46 translations (~100k in, ~100k out) |
|-------|---------------------------------------|
| gemini-2.5-flash | ~$0.28 |
| gemini-2.5-flash-lite | ~$0.05 |
| gemini-2.0-flash | ~$0.05 |

This is the cheapest approach but loses visual context and speaker identification.

---

## Rate Limits Reference

### Free Tier

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| gemini-2.5-flash | 5 | 250,000 | 20 |
| gemini-2.5-flash-lite | 10 | 250,000 | 20 |
| gemini-2.0-flash | ∞ | - | ∞ |
| gemini-2.5-pro | 0 | 0 | 0 |

### Paid Tier

Higher limits, see [official docs](https://ai.google.dev/gemini-api/docs/rate-limits).

---

## Batch API Strategy

> **Key insight**: 1-minute chunks are independent — no sequential dependency between chunks.
> This makes the pipeline **naturally batch-compatible**.

### Why Batch Works for Us

Our validated approach uses 1-minute independent chunks:
1. Each chunk is transcribed without context from previous chunks
2. No "previous cues" dependency in the prompt
3. All chunks can be submitted simultaneously

### Batch API Benefits

| Benefit | Value |
|---------|-------|
| Cost reduction | 50% off standard pricing |
| Rate limits | Much higher (designed for bulk) |
| Latency | 24-hour SLA (usually faster) |

### Batch-Compatible Pipeline

```
1. Split video into 1-min chunks (FFmpeg, local)
2. Upload all chunks to Gemini Files API
3. Submit all transcription requests as batch job
4. Wait for batch completion (typically minutes)
5. Stitch results: offset timestamps, merge overlaps
6. Submit translation as second batch job  
7. Convert to VTT
```

### Estimated Batch Costs

| Model | Standard | Batch (50% off) |
|-------|----------|----------------|
| gemini-3-pro | $4.44 | **$2.22** |
| gemini-2.5-pro | $3.32 | **$1.66** |
| gemini-2.5-flash | $0.82 | **$0.41** |
| gemini-2.5-flash-lite | $0.18 | **$0.09** |

---

## Key Takeaways

1. **Pro models for quality** — 3-pro and 2.5-pro offer best results ($1.66-$2.22/episode with batch)
2. **Flash-lite for volume** — $0.09/episode batch price for testing/iteration
3. **Batch API is natural fit** — Independent chunks enable 50% savings
4. **Free tier is dev only** — 20 RPD too limited for production
5. **gemini-2.0-flash for dev** — Unlimited free requests for testing
