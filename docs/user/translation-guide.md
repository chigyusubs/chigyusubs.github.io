# Translation Guide

> **Type**: Guide | **Status**: WIP (structured translation) | **Last Updated**: 2025-12-09 | **Owner**: Product  
> **Source of truth**: App UI + [Structured Output](../developer/structured-output.md)

Translation is secondary to transcription. It converts VTT/SRT into a compact JSON schema, calls a structured-output LLM, then rebuilds VTT.

## What you need
- **Input**: VTT/SRT from the transcription workflow or any other source (e.g., Whisper).
- **Provider**: Structured-output models only. Target models: **Gemini 2.5/3** and **OpenAI GPT-4+**. Claude is untested; Ollama support depends on model capabilities (low priority).
- **Output**: Reconstructed WebVTT file.

## Pipeline (at a glance)
1. Upload/import VTT or SRT.
2. App converts cues to a **compact JSON** array (start, end, text, speaker? if present). We keep input minimal so LLMs aren’t distracted by verbose metadata.
3. Call the selected model with structured output enabled (JSON schema).
4. Receive translated cues in the same minimal shape: one entry per cue with `id`, `text`, and optional `merge_with_next` to merge short cues.
5. Rebuild and download VTT with original timestamps preserved (merges reuse min start/max end across merged cues).

## Steps in the app
1. Select a structured-capable provider/model (Gemini 2.5/3 or GPT-4+).
2. Import your VTT/SRT.
3. (Optional) Enable glossary/summary if you need extra consistency.
4. Choose cue hinting: durations (default) or `[SHORT]` tags for sub-1.5s cues (helps the model merge quick interjections).
4. Run translation. The app handles JSON conversion, schema, and VTT rebuild.
5. Download the translated `.vtt`.

## Provider notes
- **Gemini 2.5/3**: Use JSON schema via `response_mime_type/response_schema`.
- **OpenAI GPT-4+**: Use JSON mode/JSON schema.
- **Claude**: Not tested yet.
- **Ollama**: Model-dependent; expect limited structured support (low priority).

## Known gaps
- Structured translation implementation is still in progress; legacy non-structured flows may remain in UI until replaced.
- Provider capabilities for strict JSON vary; expect tighter behavior from Gemini/OpenAI than from others.
- Media is never sent for translation; only text cues are used.
