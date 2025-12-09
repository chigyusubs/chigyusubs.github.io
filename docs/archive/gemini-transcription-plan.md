# Gemini Transcription Mode (Plan)

## Goal
Add a Gemini-driven transcription mode that converts uploaded media to VTT with accurate timestamps, while keeping the existing translation flow intact. Provide a UI toggle between Translation and Transcription, gating features per mode.

## Scope (v1)
- Mode toggle: `Translation` (current default) vs `Transcription`.
- Transcription is Gemini-only; require media upload + API key.
- Single-call transcription to start: reuse Gemini media upload and prompt Gemini to return VTT with timestamps.
- Hide translation-only inputs when in Transcription mode (e.g., subtitle file requirement).
- Persist mode in prefs.

## UX/Behavior
- Provider selection stays, but Transcription mode disables non-Gemini providers or shows a warning and reverts to Gemini.
- File uploader:
  - Translation mode: unchanged (subtitles required unless using transcription fallback).
  - Transcription mode: require media file; hide subtitle picker; keep media upload controls.
- Run flow:
  - Translation: unchanged chunked translation pipeline.
  - Transcription: build a Gemini request with `mediaUri` and a transcription prompt; no chunking in v1.
- Result: show returned VTT in the result view; allow manual VTT edit modal as today.

## Prompts (Transcription)
- System: “You are a professional transcriber. Output MUST be valid WebVTT with accurate timestamps.”
- User: “Transcribe the attached media to VTT. Preserve timing; do not translate.”

## Future Enhancements
- Chunked transcription for very long media using the existing chunk runner.
- Optional post-processing checks (overlap detection, monotonicity) similar to manual edit validation.
- Explicit model selection for Gemini transcription if needed.

## Tests
- Prefs include the new mode; toggle persists.
- Transcription mode enforces Gemini provider and media presence.
- Request builder for Gemini transcription includes `mediaUri` and transcription prompts.

## Current Implementation Notes
- Mode gating:
  - Translation: subtitles + glossary/summary + translation prompts/settings; context media hidden in transcription.
  - Transcription: required media picker, optional subtitles, transcription prompt, and transcription settings (chunk length, overlap seconds, concurrency).
- Gemini transcription flow:
  - Uses `mediaStartSeconds`/`mediaEndSeconds` to chunk; offsets cues and stitches VTT/SRT.
  - Runs on a dedicated transcription runner with pause/resume/cancel; progress/chunks update incrementally.
  - Auto-repairs VTT and normalizes loose timecodes; warnings recorded instead of failing runs.
  - Media upload supports audio-only conversion; subtitles optional in transcription mode.
- State/persistence: mode, transcription prompt, chunk length/overlap/concurrency, and overlap seconds stored in prefs.
- Known limitations: overlap cues are stitched without deduping; Gemini model reused for transcription (no separate picker yet).
