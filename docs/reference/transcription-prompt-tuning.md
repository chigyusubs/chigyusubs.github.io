# Transcription Prompt Tuning (Notes)

> **Type**: Reference | **Status**: Draft | **Last Updated**: 2025-12-11 | **Owner**: Developer

Purpose: lightweight prompt tweaks to reduce loops, keep timing clean, and preserve comedic tone without bloating responses.

## Cue Length & Splitting (Priority Fix)

**Problem:** Current "keep sentences together" guidance causes:
- Too many short cues (<1.5s rapid-fire)
- Too many long cues (10s+ spanning 3-4 lines in translation)

**Refined guidance:**
```
Cue length and splitting:
- Target 2-5 seconds per cue. Never exceed 6s.
- Split at natural pause points: clause boundaries (が、けど、て), breaths, commas
- It's OK to split mid-sentence if it improves readability
- Keep dialogue to 1-2 lines (~80 chars). Annotations don't count toward this limit.
- Avoid <1.5s cues unless pure SFX or single-word reactions
```

## Inline Annotations (for translation context)

Keep schema lean—no new fields. Use inline text annotations instead:

```
INLINE ANNOTATIONS (in cue text, for translation context):
- Speaker change: Note with "(--)" at start of cue
- On-screen text: Important telops: "(テロップ: 衝撃の事実!)"
- SFX: Sound effects: (拍手) (笑い)
- Only annotate when it adds meaning for translation. Don't over-annotate.
```

**Why `(--)` for speaker changes:**
- Minimal—just signals "different person now"
- No pressure on model to identify speakers (error-prone)
- Viewer can see and hear who is speaking
- No overlapping cues needed (avoids complexity/errors)

## Quick Tweaks (Structured Transcription)

- Timing fidelity: require `start < end` and strictly increasing cues; no overlaps.
- Anti-looping: collapse repeated filler ("まあまあまあ…") to 1–2 natural repeats; never 2 identical consecutive cues.
- Cue count guard: cap at ~120 cues per chunk; merge shortest adjacent cues if exceeded.
- Breaks: prefer breaks on speaker change, breath, scene/topic shift; avoid splitting mid-phrase.
- SFX: keep concise `(拍手) (笑い)`; avoid duplicating SFX lines.
- Milliseconds: never round to whole seconds; keep `.mmm` precision.
- JSON-only: remind model to return only JSON (no markdown).

## Translation Prompts (tone/accuracy)

- Preserve line breaks and timing; do not add/delete cues.
- Keep comedic timing; prefer concise punchy phrasing over literal filler.
- Do not sanitize slang/humor; translate faithfully.
- If unsure about a pun, pick the most natural equivalent over literal transliteration.

**Handling inline annotations from transcription:**
- `(--)` speaker change marker: Remove or keep as `--` (dash separator). Don't translate.
- `(テロップ: ...)`: Translate the content, keep the marker format: `(Caption: ...)`
- `(拍手)`, `(笑い)`, etc.: Translate to English equivalents: `(applause)`, `(laughter)`

## Glossary

- Focus on show/guest-specific terms and running gags; skip generic stopwords/interjections.
- If you don't want romaji, say so explicitly (e.g., "No romaji; use Japanese script in source.").

## Summary

- Keep under ~120–150 tokens.
- Call out comedic beats and who delivers them; include brief visual gags if clear, without inventing details.

## Schema Design Principles

**Keep schema stable across Gemini versions:**
- Same schema for Flash, Pro, and Gemini 3
- Allows retry with different model if chunk fails
- No model-specific optional fields

**Why inline annotations instead of schema fields:**
- Speaker IDs in schema add failure risk (model must identify correctly)
- On-screen text field adds latency and complexity
- Inline text `(--)`, `(テロップ: ...)` achieves same goal with zero schema change
- Translation pipeline unchanged—just text to translate

## On `lastTwoCues`

Keep it. Simple, reliable handoff: "return the last 2 cues you just emitted." Models fill it accurately and it anchors the next chunk's start/numbering. Treat defensively (ignore if missing/invalid or if times don't advance), but it pulls its weight and reduces drift.
