# Documentation Changelog

> **Type**: Changelog | **Status**: Stable | **Last Updated**: 2025-12-10 | **Owner**: Documentation
> **Source of truth**: docs/DOCUMENTATION.md

- **2025-12-10** — Added transcription session save/load feature documentation. New reference doc covers data format, resume flow, and implementation details. Use case: Gemini free tier users spreading transcription across multiple days.
- **2025-12-10** — Added structured transcription resume documentation. Covers cursor-based resume mechanism for structured transcription.
- **2025-12-10** — Clarified key handling (never persisted; in-memory only; use password manager), provider limits (Transcription = Gemini only), and warning behavior (critical pauses, aggregated short-cue warnings). Added token cost examples for transcription/translation per model.
- **2025-12-09** — Structured translation schema simplified (per-cue `id/text/merge_with_next`); prompts and reconstructor updated to allow merging short cues while preserving timings; added configurable cue hinting (durations vs `[SHORT]` tags).
- **2025-12-09** — Reframed product as transcription-first (Gemini File API, structured); added structured translation guide; updated README, index, mission, structured-output spec, and guides.
- **2025-12-09** — Added doc style/placement guide and changelog; aligned README/DOCUMENTATION links; added user transcription and testing guides to replace missing links.
