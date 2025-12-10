# Transcription Prompt Tuning (Notes)

Purpose: lightweight prompt tweaks to reduce loops, keep timing clean, and preserve comedic tone without bloating responses.

## Quick Tweaks (Structured Transcription)
- Timing fidelity: explicitly require `start < end` and strictly increasing cues; if invalid, drop/fix rather than emit bad timestamps.
- Anti-looping: collapse repeated filler (“まあまあまあ…”) to 1–2 natural repeats; never output more than 2 identical cues in a row.
- Cue count/size guard: cap at ~120 cues per chunk and ~8k chars; merge the shortest adjacent cues if you’d exceed.
- Breaks: prefer breaks on speaker change, breath, scene/topic shift; avoid splitting mid-phrase.
- SFX: keep concise `(拍手) (笑い)`; avoid duplicating SFX lines.
- Milliseconds: never round to whole seconds; keep `.mmm` precision.
- Cue length/lines: target ~1.2–6s per cue. Only allow <1s for pure SFX or single interjections; otherwise merge into neighbors. If a cue would exceed ~6–8s or 2 lines (~<200 JP chars), split at natural pauses/commas/breaths before emitting. Avoid 3–4 line cues.
- JSON-only: remind model to return only JSON (no markdown).

## Translation Prompts (tone/accuracy)
- Preserve line breaks and timing; do not add/delete cues.
- Keep comedic timing; prefer concise punchy phrasing over literal filler.
- Do not sanitize slang/humor; translate faithfully.
- If unsure about a pun, pick the most natural equivalent over literal transliteration.

## Glossary
- Focus on show/guest-specific terms and running gags; skip generic stopwords/interjections.
- If you don’t want romaji, say so explicitly (e.g., “No romaji; use Japanese script in source.”).

## Summary
- Keep under ~120–150 tokens.
- Call out comedic beats and who delivers them; include brief visual gags if clear, without inventing details.

## Schema Additions (Speaker / On-Screen Text)
- Speaker IDs: adding an optional `speaker` per cue can help downstream formatting, but increases model effort and failure risk. If added, mark it optional and accept empty values; use a short whitelist (e.g., `["host","guest","narrator","unknown"]`) instead of free text.
- On-screen text/OCR: useful for comedy lower-thirds, but heavy. Prefer a separate optional field like `screenText?: string[]` and keep it short. Expect higher latency/error rates; only enable for models with headroom (Gemini 3).
- Recommendation: keep the current schema lean for default runs. If you add fields, make them optional and guarded by a feature flag so the default path stays robust.

## On `lastTwoCues`
- Keep it. It’s a simple, reliable handoff: “return the last 2 cues you just emitted.” Models fill it accurately and it anchors the next chunk’s start/numbering. Treat defensively (ignore if missing/invalid or if times don’t advance), but it pulls its weight and reduces drift.
