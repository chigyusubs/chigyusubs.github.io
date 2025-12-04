# 🎬 Prompt Engineering for Subtitle Translation

This document explains how the **prompt system** for subtitle translation is structured, why each prompt exists, and how the glossary, summary, and translation prompts interact to produce accurate, natural subtitle translations.

---

## 🧩 Overview

The goal of this system is to produce **broadcast-quality subtitle translations** using large language models (LLMs) while ensuring:

* **Faithfulness** to original timing (WebVTT cues remain unchanged)
* **Consistency** across multi-chunk workflows (using glossary + summary context)
* **Scalability** through concurrent chunk translation
* **Privacy safety** (no persistent or logged prompts)

The pipeline is **stateless** and **self-contained** for each translation request.

---

## ⚙️ Pipeline Architecture

Each video translation job runs in **three logical stages**:

1. **Glossary Generation** – Extract recurring terms and names (optional)
2. **Summary Generation** – Build a concise context of tone and content (optional)
3. **Translation** – Translate subtitle chunks using that shared context

These stages are independent but **feed forward**:

```
Whisper Transcript (VTT)
      │
      ├─▶ Glossary →+
      │              │
      └─▶ Summary  → +→ Translation (chunked, concurrent)
```

---

## 🧠 Prompt Design Principles

### 1. Statelessness

Every chunk runs independently. No system memory is required — all needed information is embedded in the user prompt.

### 2. Separation of Concerns

* **System prompt:** Defines invariant rules (format, safety, constraints).
* **User prompt:** Supplies context (summary, glossary, previous cues, current cues).
* No duplication between them.

### 3. Determinism

Outputs must be parseable, reproducible, and free of nonessential tokens (no explanations, headers, or reasoning text).

### 4. Language-Aware Defaults

System prompts are written in English. User-specified source and target languages are dynamically inserted using placeholders:
- `<source>` – The source language (e.g., "Japanese")
- `<target>` – The target language (e.g., "English", "German", "Spanish")

The default target language is **English**.

---

## 🧾 Prompt Components

### 🧩 1. Glossary Prompt

**Purpose:**
Identify recurring or domain-specific terms so translations remain consistent across chunks.

**Generation Modes:**

The app supports two glossary generation modes:

#### Mode A: Gemini-Powered Glossary (Recommended)
When a valid Gemini API key is provided, the model extracts up to 20 relevant terms from the transcript and translates them into `<target>`, providing a short context tag.

**System Prompt:**

```js
export const DEFAULT_GLOSSARY_PROMPT =
  "You are a professional media linguist creating glossaries for subtitle translation.\n" +
  "Output MUST be valid CSV text with three comma-separated columns in this order:\n" +
  "source,target,context\n" +
  "\n" +
  "Rules:\n" +
  "- List up to 20 important or recurring terms from the transcript.\n" +
  "- Translate recognizable words and phrases into <target>, not phonetic forms.\n" +
  "- Keep proper names and brand names unchanged.\n" +
  "- Write all translations in <target>.\n" +
  "- The context column should contain a short 1–5-word description or 'unknown'.\n" +
  "- Quote any cell that contains commas.\n" +
  "- Do NOT include numbering, bullets, or extra text outside the CSV table.\n" +
  "- If no suitable terms are found, output: source,target,context followed by a single line 'none,none,none'.\n" +
  "- Use concise, factual language with neutral tone.";
```

**Example Output:**

```csv
source,target,context
クロちゃん,Kuro-chan,Name
リチ,Richi,Name
プロポーズ,Heiratsantrag,Handlung
ユニバ,Universal Studios Japan,Freizeitpark
```

#### Mode B: Frequency-Based Fallback
When no API key is available, the app uses a simple frequency-counting algorithm to extract the most common terms (no translation, just term extraction).

**Limitations:**
- No translation is performed
- No context tags are generated
- Simple CSV format: just terms with commas
- May include common but unimportant words

---

### 🧩 2. Summary Prompt

**Purpose:**
Provide the translation model with global context — tone, topic, and speaker relationships — so it can interpret idioms, sarcasm, or humor correctly.

**Generation Modes:**

The summary can be generated from two different sources:

#### Mode A: Media-Based Summary (Video/Audio)
When media is uploaded to Gemini, the summary is generated directly from the video or audio file. This provides richer context including visual cues, tone of voice, and non-verbal information.

**Media Resolution:**
- **Low resolution**: Reduces token usage for video summaries (good for token budgets)
- **Standard resolution**: Provides more visual detail (better for context-heavy content)

#### Mode B: Subtitle-Based Summary
When no media is uploaded, the summary is generated from the VTT transcript text only.

**Optional Glossary Integration:**
The summary generation can optionally include the glossary for factual accuracy (controlled by `useGlossaryInSummary` preference).

**System Prompt:**

```js
export const DEFAULT_SUMMARY_PROMPT =
  "You are summarizing <file> to support subtitle translation.\n" +
  "Read the transcript text and produce a concise global summary in <target>.\n" +
  "Include:\n" +
  "- Who is speaking or appearing (if clear).\n" +
  "- The general topic or purpose of the video.\n" +
  "- The tone or mood (e.g., calm, emotional, humorous).\n" +
  "- Major sections or acts only if clearly present.\n" +
  "Do NOT guess or invent details.\n" +
  "Keep the summary short (under 150 tokens) and factual.\n" +
  "Write the summary entirely in <target>.";
```

**Placeholders:**
- `<file>` – Replaced with "a media file" or "a transcript" depending on mode
- `<target>` – Replaced with the target language

**User Prompt Templates:**

```js
// For media-based summary:
"<glossary>Use the attached media to produce a sectioned bullet summary as instructed. 
Respond ONLY with bullets grouped by section labels."

// For subtitle-based summary:
"<glossary>Use the provided subtitles to produce a sectioned bullet summary as instructed. 
Text follows:\n\n<text>"
```

**Output Format:**

```
### GLOBAL SUMMARY ###
In der japanischen Varieté-Show „Wednesday Downtown" diskutieren die Moderatoren 
und Gäste den Höhepunkt eines Segments, in dem der Komiker Kuro-chan seiner 
Freundin Richi einen Heiratsantrag macht...
```

The summary is written entirely in the target language to provide immediate context for the translation model.

---

### 🧩 3. Translation Prompt

**Purpose:**
Translate WebVTT subtitle cues while preserving structure and naturalness.
Each translation job processes a single VTT chunk concurrently.

**System Prompt Variants:**

The system includes three different system prompts, but currently only the text-only variant
is used for translation:

#### Variant A: Text-Only Translation (Used for actual translation)

```js
export const DEFAULT_SYSTEM_PROMPT_TEXT =
  "You are a professional subtitle translator. Output MUST be valid WebVTT cues with UNCHANGED timecodes.\n" +
  "Rules:\n" +
  "- Preserve timing and line breaks exactly as in the input cues.\n" +
  "- Do NOT add, remove, merge, or split cues.\n" +
  "- Keep speaker tags and [SFX] markers; do not translate inside square brackets.\n" +
  "- Every cue must contain translated text; never leave cue text blank.\n" +
  "- If unsure, choose the most natural target-language phrasing without adding content.\n" +
  "- Return ONLY the WebVTT cues. No explanations, no headers unless present in input.\n\n";
```

#### Variant B: Video-Context Translation (Preserved for summary generation)

```js
export const DEFAULT_SYSTEM_PROMPT_VIDEO =
  "You are a professional subtitle translator. Use the attached video only to disambiguate tone, " +
  "sarcasm, laughter, and on-screen captions. Keep timing and line breaks EXACTLY as provided. " +
  "Do NOT invent content or change any timecodes. Translate ONLY the supplied cues; do not add " +
  "new cues or text outside the provided timecodes. Every cue must contain translated text; " +
  "never leave cue text blank. Do NOT echo acknowledgments or filler. Output ONLY WebVTT cues " +
  "(no extra text).";
```

#### Variant C: Audio-Context Translation (Preserved for summary generation)

```js
export const DEFAULT_SYSTEM_PROMPT_AUDIO =
  "You are a professional subtitle translator. Audio-only context is provided; use it only to " +
  "resolve tone and meaning. Keep timing and line breaks EXACTLY as provided. Do NOT invent " +
  "content or change any timecodes. Translate ONLY the supplied cues; do not add new cues or " +
  "text outside the provided timecodes. Every cue must contain translated text; never leave " +
  "cue text blank. Do NOT echo acknowledgments or filler. Output ONLY WebVTT cues (no extra text).";
```

**Selection Logic for Translation**:
- Translation workflow now exclusively uses Text-only variant to avoid sending media data

**Note (Updated 2025-12-02)**: The actual translation workflow was modified to always use
the text-only variant to avoid sending media data during subtitle translation
(removing stale multimodal codepath). The audio/video variants are now primarily
used for summary generation, not for translation chunks.

**User Prompt Structure:**

The user prompt is conditionally assembled from these sections:

```
[LANGUAGE INSTRUCTION (always included)]
Write the translation in <target>.

[GLOSSARY SECTION (optional - only if useGlossary=true and glossary exists)]
### GLOSSARY ###
<glossary CSV>

[SUMMARY SECTION (optional - only if summaryText exists)]
### GLOBAL SUMMARY ###
<summary text>

[CONTEXT SECTION (optional - only if previous cues exist)]
### PREVIOUS CONTEXT (REFERENCE ONLY, DO NOT TRANSLATE) ###
<previous 1-2 cues for continuity>

[CHUNK SECTION (always included)]
### CUES TO TRANSLATE ###
<current WebVTT chunk>
```

**Dynamic Elements:**
- **Glossary inclusion**: Controlled by `useGlossary` flag
- **Summary inclusion**: Only if summary was generated
- **Context overlap**: 
  - Audio mode: 1 previous cue
  - Video/Text mode: 2 previous cues
- **Language placeholders**: `<target>` replaced with actual target language

**Example Full Prompt:**

```
Write the translation in German.

### GLOSSARY ###
source,target,context
クロちゃん,Kuro-chan,Name
リチ,Richi,Name

### GLOBAL SUMMARY ###
In der japanischen Varieté-Show „Wednesday Downtown" diskutieren die Moderatoren...

### PREVIOUS CONTEXT (REFERENCE ONLY, DO NOT TRANSLATE) ###
00:01:15.000 --> 00:01:18.000
みんな、今日は特別な日だよ

### CUES TO TRANSLATE ###
00:01:18.500 --> 00:01:22.000
クロちゃんがプロポーズするんだ

00:01:22.500 --> 00:01:25.000
本当に？信じられない！
```

---

## 📦 Design Notes

* **Glossary** anchors meaning and avoids drift in concurrent translations.
* **Summary** gives the model emotional and narrative grounding.
* **Translation** prompt enforces strict formatting and natural target-language fluency.
* **Conditional sections** keep prompts lean and relevant (only include what's needed).
* **Media context** provides tone, sarcasm, and visual cues when available.

These components together prevent:

* Literal or monotone translations
* Repeated name mistranslations
* Tone inconsistency between chunks
* Formatting breakage (non-parseable VTT output)
* Loss of context at chunk boundaries

---

## 🧭 Prompt Lifecycle Summary

| Stage           | Input                                  | Output                         | Reused In             |
| --------------- | -------------------------------------- | ------------------------------ | --------------------- |
| **Glossary**    | Whisper transcript (+ API key)         | CSV glossary or term list      | Summary + Translation |
| **Summary**     | Media/transcript (+ optional glossary) | Target-language global summary | Translation           |
| **Translation** | VTT chunk + summary + glossary         | Translated VTT cues            | —                     |

---

## 💡 Best Practices

* Always include `source,target,context` header in glossaries (Gemini mode).
* Keep `GLOBAL SUMMARY` and `GLOSSARY` identical across all translation chunks.
* Pass 1–2 previous cues to avoid sentence cutoff at chunk boundaries.
* Use `<source>` and `<target>` placeholders dynamically for multilingual jobs.
* Never persist user data — prompts are ephemeral and privacy-safe.
* Use media-based summaries for content where tone and visual context matter (variety shows, comedy).
* Use subtitle-based summaries for straightforward content or when token budget is tight.

---

## 🎯 Media Mode Comparison

| Feature                  | Text-Only        | Audio Context      | Video Context      |
| ------------------------ | ---------------- | ------------------ | ------------------ |
| **Token Usage**          | Lowest           | Medium (~32/sec)   | High (~258-300/sec)|
| **Tone Detection**       | Limited          | Good               | Excellent          |
| **Visual Cues**          | None             | None               | Yes (captions, etc)|
| **Sarcasm/Humor**        | Limited          | Good               | Excellent          |
| **Chunk Duration**       | 600s (default)   | 300s (max)         | 600s (default)     |
| **Context Overlap**      | 2 cues           | 1 cue              | 2 cues             |
| **Best For**             | Straightforward  | Voice-heavy shows  | Variety shows      |

---

## 🔧 Adaptive Logic

The translation system includes several adaptive behaviors:

### Chunk Duration
- **Audio mode**: Automatically limits chunks to 300 seconds (5 minutes) to manage token usage
- **Video/Text mode**: Uses configured chunk size (default 600 seconds / 10 minutes)

### Context Overlap
- **Audio mode**: 1 previous cue (reduces token overhead)
- **Video/Text mode**: 2 previous cues (better continuity)

### Prompt Assembly
- Sections are conditionally included based on availability:
  - Skip glossary if empty or disabled
  - Skip summary if not generated
  - Skip context if processing first chunk

---

## 🚀 Results

When all components are combined (Glossary + Summary + Translation with optional media context), the model produces:

* **Natural, idiomatic subtitles** tailored to the target language
* **Emotionally accurate tone** (sarcasm, humor, emphasis)
* **Perfectly preserved timing** (no timecode drift)
* **Cross-chunk consistency** (names, terms, style)
* **Format compliance** (valid WebVTT that passes validation)

---

## 🔍 Quality Control

The system includes multiple validation layers:

1. **Pre-translation**: Parse source VTT to ensure valid input
2. **Auto-repair**: Automatically fix common model output issues
3. **Timecode validation**: Ensure translated cues match source timecodes exactly
4. **Loop detection**: Flag chunks with excessive repetition
5. **Empty text detection**: Fail chunks where model left cue text blank
6. **VTT validation**: Full format validation before accepting output

These checks ensure high-quality, broadcast-ready output.
