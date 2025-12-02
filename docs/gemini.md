# Gemini API Quick Reference

This project targets the Gemini API with free-tier keys and a browser-only client. Use this as a cheat sheet; prefer the official docs for full details.

## Model guidance

- Default: Gemini 2.5 Pro for production runs (better summaries/glossaries, lower hallucination, supports ~10-minute chunks).
- Flash/Flash Preview: use mainly for quick testing; quality and chunk length are lower (~2 minutes reliably).
- Keep translation prompts text-only; uploaded media is only for summary generation.

## Free-tier rate limits (per project)

- Gemini 2.5 Pro: 2 RPM, ~125k TPM, 50 RPD.
- Gemini 2.5 Flash/Flash Preview: 10 RPM, ~250k TPM, 250 RPD.
- Quotas can change; check AI Studio for current limits.
- Concurrency is capped at 10 in the app to respect free-tier RPM.
- Safety filters: defaults block medium+ probability for most categories. Turning safety off or relaxing thresholds can trigger Google review; use the safety toggle sparingly and only if a use case demands it.

## File upload constraints (Gemini File API)

- Max file size: 2GB per upload; total stored files: 20GB.
- In this app, uploaded media is used only to generate summaries; translations remain text-only.
- Files expire after ~48 hours; File API is free and only for upload/reference (no download). Prefer File API when total request size would exceed ~20MB; inline is for small media only.

## Media resolution (for summaries)

- Use low/standard media resolution for uploaded video to keep token usage and latency down.
- Increase only if summary quality clearly benefits; avoid token-heavy settings to stay within free-tier TPM.

## Video handling (summary-only in this app)

- Upload via the File API for reuse; keep files well under the 2GB cap (prefer short clips for low token cost). Inline video is only practical <20MB.
- One video per request is recommended for quality; Flash/Pro can handle one video with text prompts. We do not pass YouTube URLs.
- Token costs (Gemini 2.5 models, default media resolution): ~300 tokens/second of video (1 fps frames at ~258 tokens + ~32 audio tokens). Low media resolution drops this to ~100 tokens/second. Keep uploads short to stay within TPM.
- Default processing samples ~1 frame/second; fast action may lose detail. For summaries, low/standard resolution is usually sufficient; avoid high unless text-heavy frames truly need it.

## Audio handling (summary-only in this app)

- Prefer File API uploads for audio you’ll reuse; inline audio only works when the whole request stays under ~20MB.
- Typical use: 45–120 minute talks/lectures fit in context; remember ~32 tokens/second (~1,920 tokens/minute), so shorter clips are friendlier to free-tier TPM.
- Use trimmed mono 16 kHz (or the app’s audio-only extraction) to minimize size. One audio file per request is recommended for quality.

## Token basics (quick math)

- Gemini tokens are ~4 characters (~60–80 English words per 100 tokens).
- Text is counted directly; system instructions and tools count toward input tokens.
- Approx tokenization rates for media (Gemini 2.5): video ~263 tokens/sec (about 300/sec combined with audio at default media resolution), audio ~32 tokens/sec. Low media resolution drops video to ~100 tokens/sec. Use these to estimate TPM impact.

## References

- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- File API: https://ai.google.dev/gemini-api/docs/files
- Media resolution: https://ai.google.dev/gemini-api/docs/media-resolution
