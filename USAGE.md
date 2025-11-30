# Usage Guide

Detailed documentation for ChigyuSubs features and workflows.

## Optional media prep tips

- For text-only runs, you can skip media upload entirely.
- If you upload media for context and want to keep it small, a lightweight video is fine; if you choose audio-only, the video codec doesn't matter. A practical downscale command:
  ```bash
  ffmpeg -i input.mp4 \
    -vf "scale='min(640,iw)':-2,fps=1" \
    -c:v libx264 -profile:v baseline -preset veryfast -crf 30 \
    -c:a aac -ac 1 -ar 16000 -b:a 48k \
    -movflags +faststart \
    output_llm.mp4
  ```
  For audio-only context: `ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a aac -b:a 48k output.m4a`

## UI basics

- **Inputs**: VTT or SRT subtitles; optional media for context summary only (not sent with chunk prompts).
- **Context**: you can generate a media summary (optional) and a glossary from subtitles; both are editable and can be toggled on/off.
- **Prompts**: the system prompt holds the guardrails (editable). User prompt is structured data (langs, style, optional summary/glossary, context, cues). Glossary lives in the user prompt only.
  - **Controls**: concurrency, chunk length, style (freeform), temperature, summary/glossary toggles. Defaults are tuned for Gemini 2.5 Pro (10m chunks, concurrency 2). Concurrency is capped at 10 even if you enter a higher number (to respect Gemini 2.5 Flash free-tier RPM). Overlap pulls prior cues (default 2) as context; raise if you see continuity issues.

## Guidance for glossary & summary

- Generate both to save time, but plan to skim and edit before large runs for best consistency.
- Keep glossary entries canonical (names/terms in one form). If the summary paraphrases names, tighten it up or keep names in the source language to avoid nudging variants.
- The model prioritizes the glossary for term consistency; the summary is secondary context. Differences between them typically don't break translation, but cleaning them up reduces variance.

## Buttons & behaviors

- **Translate**: validates subtitles + API key, parses/chunks, and sends only the subtitle text to Gemini for translation. It does not upload or extract media; media is ignored unless you have already uploaded it for summary generation.
- **Upload media to Gemini**: uploads the selected media file solely for summary generation. If "Upload audio-only" is checked and you chose a video, it first extracts audio to a small mono OGG and uploads that smaller file.
- **Delete uploaded media**: removes the previously uploaded media from Gemini and clears local refs.
- **Refresh models**: lists available Gemini models using your API key and updates the dropdown.
- **Generate summary from media**: runs a summary request against the uploaded media; fills the summary text field.
- **Generate from subtitles (glossary)**: builds a glossary from your subtitles (local heuristic if no API key; Gemini call if key is present).
- **Toggles**: "Upload audio-only" controls extraction during upload; "Use summary in translation" and "Use glossary in translation" decide whether those optional contexts are included in the prompt payload.
- **Pause**: stops starting new chunks/retries (in-flight calls continue). Designed to avoid wasting RPM/TPM/cost on stale runs.
- **Reset**: clears progress and drops queued work while keeping uploaded media.
- **Restore defaults**: per-field restore buttons reset prompts; the footer "Restore defaults" resets saved preferences but keeps summary/glossary text. It does not affect files or API key.
