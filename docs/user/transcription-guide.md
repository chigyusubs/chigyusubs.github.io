# Transcription Guide

> **Type**: Guide | **Status**: Primary | **Last Updated**: 2025-12-09 | **Owner**: Product  
> **Source of truth**: App UI + [Transcription Workflow](../reference/transcription-workflow.md)

Structured transcription is the main feature: Gemini File API only, structured mode only, tuned for Japanese comedy.

## What you need
- **Provider**: Gemini 2.5/3 via File API (required; others are not supported for transcription).
- **Input**: Video or audio file; Japanese comedy is the primary target.
- **Output**: Structured JSON plus WebVTT (VTT) for direct playback or translation.
- **Keys**: Keys are not persisted; they live only in the tab. Use your browser’s password manager if you want to save per-provider keys.

## Steps
1. Select **Gemini** as provider (File API).
2. Click **Upload media** and select your video/audio file.
3. Leave the defaults (1-minute chunks, conservative concurrency) unless you have a reason to change them.
4. Start transcription; media is sent only to Gemini for this step, and structured JSON is produced.
5. Download the generated `.vtt` (or JSON if you need structured processing).

## Tips
- Keep files reasonable; long videos increase processing time and token use.
- If accuracy drops, reduce chunk size or concurrency and retry.
- Preserve the VTT timestamps; do not edit them before translation.
- For translation, import the generated VTT and follow the [Translation Guide](./translation-guide.md); the app will convert it to compact JSON before calling a structured-output model.

## Known limitations
- Optimized for Japanese comedy; other genres may need manual cleanup.
- Media uploads are for transcription only; translation never sends media.
- No speaker diarization; add speaker tags manually if needed.
