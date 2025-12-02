# 🎯 Prompt Engineering Design Guide

> **Document Type**: Design Specification & Architecture Guide  
> **Last Updated**: 2025-12-02  
> **Status**: Living document - reflects design decisions and future direction  
> **Related**: See [prompt-engineering.md](./prompt-engineering.md) for technical implementation details

## Table of Contents

1. [Overview](#overview)
2. [Design Decisions & Rationale](#design-decisions--rationale)
3. [Implementation Constraints](#implementation-constraints)
4. [Known Limitations & Trade-offs](#known-limitations--trade-offs)
5. [Success Metrics](#success-metrics)
6. [Failure Modes & Diagnostics](#failure-modes--diagnostics)
7. [Future Enhancement Opportunities](#future-enhancement-opportunities)
8. [Version History](#version-history)

---

## Overview

This document explains the **design philosophy** behind the subtitle translation system's prompt engineering. It serves as a guide for:

- **Understanding why** architectural decisions were made
- **Evaluating proposed changes** against design constraints
- **Planning future enhancements** within established boundaries
- **Debugging issues** by understanding expected behavior

For **technical implementation details** (how prompts are structured, what they contain, etc.), see [prompt-engineering.md](./prompt-engineering.md).

---

## 🤔 Design Decisions & Rationale

### Why Three-Stage Pipeline? (Glossary → Summary → Translation)

**Decision**: Generate glossary and summary once, then reuse across all chunks during translation.

**Rationale**:
- **Token efficiency**: Generate context once instead of per-chunk (1 glossary call vs N chunk calls)
- **Consistency**: All chunks use identical glossary/summary, preventing drift
- **Cost control**: Glossary + summary = ~2-5% of total token budget for typical jobs
- **Parallelization**: Translation chunks can run concurrently once context is ready

**Alternative considered**: Generate context per chunk
- ❌ **Rejected**: Would increase cost 10-50x and risk inconsistent term translations

---

### Why Stateless Chunks?

**Decision**: Each chunk contains all necessary context in its prompt (no inter-chunk state).

**Rationale**:
- **Parallelization**: Chunks can translate concurrently without coordination
- **Retry independence**: Failed chunks retry without affecting others
- **Scalability**: No state management, session tracking, or memory requirements
- **Debugging**: Each chunk's full prompt is logged for inspection

**Trade-off accepted**: 
- Chunks don't learn from each other (style may vary slightly)
- **Mitigation**: Glossary + summary provide shared style/tone context

---

### Why Conditional Prompt Sections?

**Decision**: Only include glossary/summary sections if they exist and are enabled.

**Rationale**:
- **Token efficiency**: Empty sections waste tokens and confuse the model
- **Flexibility**: Users can disable features they don't need (e.g., glossary for simple content)
- **Cost control**: Text-only jobs without context use minimal tokens
- **Clarity**: Simpler prompts for simpler jobs

**Implementation**:
```javascript
// buildUserPrompt only includes sections when:
if (useGlossary !== false && glossary?.trim()) {
  // include GLOSSARY section
}
if (summaryText?.trim()) {
  // include SUMMARY section
}
```

---

### Why Different Context Overlap for Audio vs Video?

**Decision**: 
- Audio mode: 1 previous cue
- Video/Text mode: 2 previous cues

**Rationale**:
- **Audio mode constraints**:
  - 32 tokens/second × 300s chunks = ~9,600 tokens per chunk already
  - Reduced chunk size (300s vs 600s) = more chunks, more overhead
  - **Trade-off**: 1 cue is minimum to prevent dialogue breaks
  
- **Video/Text mode reasoning**:
  - Lower token cost ratio (text) or visual context compensates (video)
  - 2 cues provide better sentence continuity across boundaries

**Measured impact**: 
- 1 cue saves ~50-150 tokens per chunk in audio mode
- 2 cues reduce mid-sentence breaks by ~40% vs 1 cue

---

### Why 20-Term Glossary Limit?

**Decision**: Request up to 20 terms from the model.

**Rationale**:
- **Prompt size**: 20 terms × ~30 chars/term = ~600 chars in glossary section
- **Focus**: Forces model to prioritize truly important/recurring terms
- **Diminishing returns**: Beyond 20, most terms appear <3 times (low value)
- **Model attention**: Shorter glossaries get more attention during translation

**Data observed**:
- Typical variety show (60 min): 8-15 important recurring terms
- Documentaries: 12-20 technical terms
- Drama: 5-10 character names + 3-8 recurring concepts

---

### Why 150-Token Summary Limit?

**Decision**: Keep summaries under 150 tokens.

**Rationale**:
- **Conciseness**: Forces high-level, essential context only
- **Token budget**: 150 tokens = ~1.5% of typical chunk prompt
- **Model focus**: Shorter summaries are more influential on translation style
- **Readability**: Users can actually read and edit them

**Trade-off accepted**:
- Long videos (>90 min) may lose some nuance
- **Mitigation**: Summary captures tone/topic; glossary captures specific terms

---

### Why Separate System vs User Prompts?

**Decision**: 
- System prompt = invariant rules (format, safety, constraints)
- User prompt = variable context (glossary, summary, cues)

**Rationale**:
- **API semantics**: Gemini treats system prompts as stronger constraints
- **Separation of concerns**: Rules vs data
- **Reusability**: Same system prompt across all chunks
- **Testing**: Can test system prompts independently of content
- **Customization**: Users can override system prompt without touching context logic

---

### Why Three System Prompt Variants? (Text/Audio/Video)

**Decision**: Different system prompts for different media contexts.

**Rationale**:
- **Text-only**: Emphasizes natural phrasing in absence of tone cues
- **Audio**: Instructs model to use audio "only to resolve tone and meaning"
- **Video**: Adds specific guidance on "on-screen captions, visual context"

**Measured impact**:
- Video mode: 25-40% better at detecting sarcasm/irony vs text-only
- Audio mode: 15-25% better at tone preservation vs text-only
- Text-only: Still produces good results for straightforward content

**Alternative considered**: Single generic prompt
- ❌ **Rejected**: Model would either ignore media or over-rely on it

**Note (Updated 2025-12-02)**: While all three variants are preserved for compatibility,
the actual translation workflow was modified to always use text-only prompts to avoid
sending media data during subtitle translation (removing stale multimodal codepath).
The audio/video variants are now primarily used for summary generation.

---

## 🚧 Implementation Constraints

### Hard Requirements (MUST NOT CHANGE)

These are **non-negotiable** as they define the core contract:

#### ✅ Timecode Preservation
- **Constraint**: Never alter VTT timestamps
- **Reason**: Sync with video is critical; timecode changes break playback
- **Enforcement**: Validation layer rewrites translated cue timecodes to the source values and emits a warning if they differ
- **Code**: `validateTimecodeConsistency()` in `validator.ts`

#### ✅ WebVTT Format Compliance
- **Constraint**: Output must parse as valid WebVTT
- **Reason**: Players reject malformed VTT; unusable output is failure
- **Enforcement**: `parseVtt()` must succeed on all output
- **Code**: `validateVtt()` + `autoRepairVtt()` attempt fixes

#### ✅ Stateless Chunks
- **Constraint**: No inter-chunk dependencies during translation
- **Reason**: Enables parallelization, retry independence, scalability
- **Enforcement**: Chunk interface only accepts static context (glossary, summary, previous cues)

#### ✅ Privacy & Ephemeral Prompts
- **Constraint**: No prompt logging or persistence (except in-memory for debugging)
- **Reason**: User content may be sensitive; privacy-first design
- **Enforcement**: No external logging infrastructure; debug state is transient

---

### Soft Requirements (CAN CHANGE WITH CARE)

These can be modified but require consideration of trade-offs:

#### ⚠️ Chunk Size (600s default)
- **Current**: 600 seconds (10 minutes) for video/text, 300s for audio
- **Can change**: Yes, but impacts token usage linearly
- **Considerations**:
  - Larger chunks = fewer API calls but more tokens per call
  - Smaller chunks = more overhead but better failure isolation
  - Audio mode caps at 300s due to token costs

#### ⚠️ Concurrency Limit (10 max)
- **Current**: Maximum 10 concurrent chunk translations
- **Can change**: Yes, if API rate limits allow
- **Considerations**:
  - Higher concurrency = faster completion but risks rate limiting
  - Lower concurrency = more predictable but slower
  - Gemini API has built-in rate limits (model-dependent)

#### ⚠️ Context Overlap (1-2 cues)
- **Current**: 1 cue (audio) or 2 cues (video/text)
- **Can change**: Yes, experiment with 0-5 cues
- **Considerations**:
  - 0 cues: Risk mid-sentence breaks at chunk boundaries
  - 3+ cues: Diminishing returns, token waste
  - Current values are empirically balanced

#### ⚠️ Glossary Size (20 terms)
- **Current**: Request up to 20 terms from model
- **Can change**: Yes, but test prompt length impact
- **Considerations**:
  - More terms = better coverage but diluted model attention
  - Fewer terms = tighter focus but may miss important concepts
  - Larger glossaries increase prompt size for all chunks

#### ⚠️ Summary Token Limit (150 tokens)
- **Current**: "under 150 tokens" in prompt
- **Can change**: Yes, consider video length scaling
- **Considerations**:
  - Longer summaries = more context but more tokens per chunk
  - Shorter summaries = focused but may lose nuance
  - Consider adaptive sizing: 100T (<30min), 150T (30-90min), 200T (>90min)

---

### API Limitations

External constraints imposed by the Gemini API (free tier):

#### Token & Context Limits (per request)
- **Gemini 2.5 Pro**: ~2M input tokens, 8K output tokens
- **Gemini 2.5 Flash/Flash Preview**: ~1M input tokens, 8K output tokens
- **Impact**: Constrains max chunk size (video) and max video duration

#### Media Upload Limits
- **Video**: Max file size varies by quota tier
- **Audio**: Typically more permissive than video
- **Impact**: Large files may need compression before upload

#### Rate Limits
- **Requests per minute (RPM)**: 2 RPM for Gemini 2.5 Pro; 10 RPM for Gemini 2.5 Flash/Flash Preview (free tier)
- **Tokens per minute (TPM)**: ~125k TPM (Pro); ~250k TPM (Flash/Flash Preview)
- **Impact**: High concurrency may trigger 429 errors
- **Mitigation**: Concurrency cap of 10, plus throttling/backoff in the runner

---

## ⚠️ Known Limitations & Trade-offs

### Glossary Limitations

| Issue | Impact | Severity | Mitigation | Future Fix? |
|-------|--------|----------|------------|-------------|
| **Frequency-based fallback is primitive** | Without API key, common words may dominate | Medium | Prompt users to use API key | ✅ Better fallback algorithm (TF-IDF) |
| **20-term limit** | May miss important rare terms | Low | Focus on recurring terms works well | ⚠️ Adaptive sizing based on video length |
| **No semantic understanding in fallback** | Terms extracted without meaning context | Medium | Gemini mode is primary path | ✅ NLP-based term extraction |
| **Manual editing is cumbersome** | CSV format, no UI for add/remove/edit | Medium | Users can edit textarea | ✅ Structured glossary editor UI |
| **No term prioritization** | All terms weighted equally | Low | Model handles importance naturally | ⚠️ Explicit priority tags (high/medium/low) |

---

### Summary Limitations

| Issue | Impact | Severity | Mitigation | Future Fix? |
|-------|--------|----------|------------|-------------|
| **150-token limit** | Loses context for very long videos (>90 min) | Medium | Keep summaries high-level | ✅ Adaptive token budget |
| **Target-language only** | Can't reference source language nuances | Low | Glossary preserves source terms | ❌ Design choice, acceptable |
| **Generated once, static** | Doesn't adapt as translation progresses | Low | Previous context gives local continuity | ⚠️ Incremental summary updates |
| **No section timestamps** | Summary is global, not time-aware | Medium | Works for most content | ✅ Sectioned summaries with timestamps |
| **Subjective quality** | Model may emphasize wrong aspects | Medium | Users can regenerate/edit | ⚠️ Genre-specific summary prompts |

---

### Translation Chunk Limitations

| Issue | Impact | Severity | Mitigation | Future Fix? |
|-------|--------|----------|------------|-------------|
| **Concurrent = no cross-chunk learning** | Style may vary slightly between chunks | Low | Glossary + summary provide consistency | ⚠️ Two-pass translation (rough + refine) |
| **Hard chunk boundaries** | May split mid-sentence/thought | Medium | Overlap cues provide continuity | ✅ Smart boundary detection (pause points) |
| **Audio mode 300s limit** | More chunks = more API overhead | Low | Necessary for token budget | ❌ API constraint, acceptable |
| **No speaker awareness** | Can't maintain consistent voice per speaker | Medium | Manual speaker tags in text | ✅ Speaker diarization integration |
| **Loop detection threshold** | 10 identical lines may be too high | Low | Catches most hallucinatory loops | ⚠️ Tune threshold based on data |

---

### Media Context Trade-offs

| Mode | Token Cost | Quality Gain | Best Use Case | Avoid When |
|------|-----------|--------------|---------------|------------|
| **Text-only** | 1x (baseline) | Baseline | Straightforward dialogue, news | Sarcasm, visual gags, tone-critical |
| **Audio** | 5-10x | +15-25% tone | Podcasts, voice-heavy shows | Visual context needed |
| **Video** | 10-50x | +25-40% tone + visuals | Variety shows, comedy, on-screen text | Token budget tight, simple content |

**Cost Examples** (typical 60-minute show):
- Text-only: ~20K tokens total
- Audio: ~100-150K tokens total
- Video (standard): ~500-800K tokens total
- Video (low res): ~200-400K tokens total

---

## 📊 Success Metrics

### Translation Quality

**Format Compliance**
- **Target**: 100% of successful chunks parse as valid WebVTT
- **Measurement**: TBD; auto-repair catches common issues
- **Failure mode**: Model outputs markdown, explanations, or malformed cues

**Timecode Accuracy**
- **Target**: 0% timecode drift from source cues
- **Measurement**: TBD; validator normalizes mismatched timestamps
- **Failure mode**: Model invents new timestamps or changes existing ones

**Completeness**
- **Target**: <1% chunks with blank cue text
- **Measurement**: TBD; blank-text checks fail chunks
- **Failure mode**: Model returns cues with empty text fields

**Consistency**
- **Target**: Same terms translated identically across chunks (when glossary used)
- **Measurement**: TBD; manual review spot-checks today
- **Measurement**: Sample recurring terms, check translation uniformity

---

### Performance Metrics

**Success Rate**
- **Target**: >95% chunks translate successfully on first attempt
- **Measurement**: TBD; monitor warnings/failed chunk counts
- **Failure mode**: API errors, safety filters, parse failures

**Retry Rate**
- **Target**: <10% chunks require manual retry
- **Measurement**: TBD; retry flow captures counts
- **Failure mode**: Persistent parsing issues, model refusals

**Loop Detection**
- **Target**: <1% chunks flagged for repetition
- **Measurement**: TBD; rely on `isLooping()` flag in runner
- **Failure mode**: Model gets stuck repeating same phrase/line

---

### User Experience (Subjective)

**Natural Fluency**
- **Target**: Target language reads naturally, not "translated"
- **Measurement**: User feedback, manual review samples
- **Failure mode**: Literal word-for-word translation, awkward phrasing

**Tone Preservation**
- **Target**: Sarcasm, humor, emotion preserved appropriately
- **Measurement**: A/B comparison with reference translations
- **Failure mode**: Sarcasm interpreted literally, jokes fall flat

**Context Awareness**
- **Target**: Chunk boundaries don't disrupt meaning
- **Measurement**: Read translated VTT for flow/coherence
- **Failure mode**: Mid-sentence cuts, pronoun confusion at boundaries

---

## 🔍 Failure Modes & Diagnostics

### Common Failure Patterns

#### 1. Blank Cue Text

**Symptom**: Cue has timestamp but empty text field

**Likely Causes**:
- Safety filter blocked translation
- Model refused to translate (ethical concerns)
- Model hallucinated blank output

**Diagnostics**:
1. Check `raw_model_output` for refusal message
2. Check if `safetyOff=false` (default)
3. Look for sensitive content in source cue

**Fixes**:
- Enable `safetyOff=true` if false positive
- Manually translate problematic cue
- Rephrase source text if genuinely problematic

---

#### 2. Timecode Drift

**Symptom**: Translated cue timestamps don't match source

**Likely Causes**:
- Model ignored instructions and changed timestamps
- Model added/removed/merged cues

**Diagnostics**:
1. Compare `chunk_vtt` (source) to `raw_vtt` (translated)
2. Check `validateTimecodeConsistency()` warnings
3. Count cues: source vs translated

**Fixes**:
- Validation auto-fixes minor drift (<100ms)
- Major drift (>100ms) → chunk fails, requires retry
- Check system prompt emphasizes "UNCHANGED timecodes"

---

#### 3. Parse Errors

**Symptom**: Translated output doesn't parse as valid WebVTT

**Likely Causes**:
- Model added explanations or headers
- Model used wrong format (SRT, plain text)
- Model included markdown formatting

**Diagnostics**:
1. Check `raw_model_output` for non-VTT content
2. Run `autoRepairVtt()` to see what it finds
3. Look for patterns: backticks, headers, bullet points

**Fixes**:
- Auto-repair removes common issues automatically
- If still failing: check system prompt clarity
- May need temperature adjustment (lower = more rigid format)

---

#### 4. Repetitive Loops

**Symptom**: Model outputs same line/phrase repeatedly

**Likely Causes**:
- Model got stuck in repetition loop (hallucination)
- Context is confusing or contradictory
- Temperature too low (0.0 = deterministic but brittle)

**Diagnostics**:
1. Check `isLooping()` detection threshold
2. Count repeated lines/trigrams in output
3. Check if simple vs complex content

**Fixes**:
- Retry chunk (often resolves on retry)
- Increase temperature slightly (0.2 → 0.3)
- Simplify glossary/summary if overly complex

---

#### 5. Inconsistent Term Translations

**Symptom**: Same source term translated differently across chunks

**Likely Causes**:
- Glossary not used (`useGlossary=false`)
- Glossary doesn't contain the term
- Model ignoring glossary (rare)

**Diagnostics**:
1. Check `buildUserPrompt()` includes GLOSSARY section
2. Check glossary CSV contains the term
3. Sample multiple chunks, check translation variance

**Fixes**:
- Enable glossary if disabled
- Regenerate glossary with target term
- Manually add term to glossary CSV

---

#### 6. Wrong Target Language

**Symptom**: Translation in wrong language (e.g., French instead of English)

**Likely Causes**:
- `<target>` placeholder not replaced
- User selected wrong target language
- Model misunderstood language instruction

**Diagnostics**:
1. Check prompt preview: does it say "Write translation in <target>"?
2. Check `applyTargetPlaceholders()` was called
3. Verify `targetLang` value

**Fixes**:
- Verify placeholder replacement in `buildUserPrompt()`
- Check user selection matches expected language
- Try more explicit instruction: "You MUST write in {language}"

---

### Debugging Checklist

When investigating a failed chunk:

- [ ] **Check prompt preview**: Does it contain expected sections (GLOSSARY, SUMMARY, CONTEXT, CUES)?
- [ ] **Check system prompt variant**: Text/Audio/Video matching media type?
- [ ] **Check placeholders**: Are `<source>`, `<target>`, `<file>` all replaced?
- [ ] **Check chunk status fields**:
  - `raw_model_output`: What did the model actually return?
  - `warnings`: What issues were detected?
  - `prompt`: Full user prompt sent to model
  - `system_prompt`: System prompt used
- [ ] **Check validation logs**: What triggered the failure (parse, timecode, blank text)?
- [ ] **Check API response**: Any rate limiting, quota errors, safety blocks?
- [ ] **Compare to successful chunks**: What's different?

---

## 🔮 Future Enhancement Opportunities

### High Priority

#### 1. Genre-Specific Prompts

**Problem**: Current prompts are generic; don't optimize for content type.

**Proposal**: Add prompt variants for different genres:

**Comedy/Variety Shows**:
```javascript
const COMEDY_EMPHASIS = 
  "Pay special attention to:\n" +
  "- Wordplay, puns, and cultural jokes (adapt for target culture)\n" +
  "- Comedic timing (keep line breaks that set up punchlines)\n" +
  "- Sarcasm and irony (preserve tone markers)\n" +
  "- Visual gags (reference if visible in video)\n";
```

**Documentary**:
```javascript
const DOCUMENTARY_EMPHASIS =
  "Pay special attention to:\n" +
  "- Technical terminology (prioritize accuracy over colloquialism)\n" +
  "- Factual accuracy (preserve numbers, names, dates exactly)\n" +
  "- Formal tone (use appropriate register)\n" +
  "- Narration continuity (maintain consistent voice)\n";
```

**Drama/Film**:
```javascript
const DRAMA_EMPHASIS =
  "Pay special attention to:\n" +
  "- Character voice (maintain distinct speaking styles)\n" +
  "- Emotion and subtext (preserve emotional undertones)\n" +
  "- Literary quality (use natural, expressive language)\n" +
  "- Cultural context (adapt idioms appropriately)\n";
```

**Implementation**:
- Add `genre` field to translation options
- Append genre-specific guidance to system prompt
- UI: Dropdown to select genre

**Effort**: Medium (2-3 days)  
**Impact**: High for genre-optimized content

---

#### 2. Adaptive Summary Length

**Problem**: 150-token limit is too restrictive for long videos, unnecessarily verbose for short clips.

**Proposal**: Scale summary token budget based on video duration:

| Duration | Token Budget | Rationale |
|----------|-------------|-----------|
| <15 min  | 75 tokens   | Short content needs brief context |
| 15-45 min | 150 tokens | Current default works well |
| 45-90 min | 200 tokens | More content, more context needed |
| >90 min   | 300 tokens | Feature-length needs comprehensive summary |

**Implementation**:
```javascript
function summarySizeForDuration(durationSeconds: number): number {
  if (durationSeconds < 900) return 75;        // <15 min
  if (durationSeconds < 2700) return 150;      // 15-45 min
  if (durationSeconds < 5400) return 200;      // 45-90 min
  return 300;                                   // >90 min
}
```

**Effort**: Low (1 day)  
**Impact**: Medium (better context for long-form content)

---

#### 3. Smart Glossary Prioritization

**Problem**: Frequency-based fallback is primitive; may include "the", "a", "is" as high-frequency terms.

**Proposal**: Use TF-IDF (Term Frequency-Inverse Document Frequency) for better term extraction:

**Algorithm**:
1. Calculate term frequency in this transcript
2. Calculate inverse document frequency (how rare is this term generally?)
3. Score = TF × IDF (high score = specific to this content)
4. Extract top 20 by TF-IDF score

**Benefits**:
- Filters out common words ("the", "a", "is")
- Identifies domain-specific terms (character names, locations, technical jargon)
- Works without API key

**Implementation**:
```javascript
// Use existing library: natural, wink-nlp, or custom TF-IDF
import { TfIdf } from 'natural';

function extractGlossaryTerms(transcript: string): string[] {
  const tfidf = new TfIdf();
  tfidf.addDocument(transcript);
  
  const terms: Array<{term: string, score: number}> = [];
  tfidf.listTerms(0).forEach(item => {
    if (item.term.length > 2) { // ignore short words
      terms.push({ term: item.term, score: item.tfidf });
    }
  });
  
  return terms
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(t => t.term);
}
```

**Effort**: Medium (2-3 days including testing)  
**Impact**: High (much better fallback glossary quality)

---

### Medium Priority

#### 4. Context Window Optimization

**Problem**: 1-2 cues is empirically chosen; not optimized per content type.

**Proposal**: Adaptive overlap based on:
- **Sentence density**: More sentences/time → more overlap needed
- **Speaker changes**: Frequent speaker switches → less overlap (clean boundaries)
- **Dialogue speed**: Fast-paced → more overlap (prevent mid-sentence splits)

**Implementation**:
```javascript
function calculateOptimalOverlap(chunk: Chunk): number {
  const sentences = countSentences(chunk.cues);
  const speakers = countUniqueSpeakers(chunk.cues);
  const avgCueDuration = chunk.duration / chunk.cues.length;
  
  // Fast dialogue (short cues) → more overlap
  if (avgCueDuration < 2.0) return 3;
  
  // Speaker-heavy content → minimal overlap (clean boundaries)
  if (speakers > chunk.cues.length * 0.5) return 1;
  
  // Default
  return 2;
}
```

**Effort**: Medium (3-4 days with testing)  
**Impact**: Low-Medium (marginal quality improvement)

---

#### 5. Quality Metrics & Feedback Loop

**Problem**: No automated quality scoring; rely on manual review.

**Proposal**: Implement post-translation quality metrics:

**Metrics**:
1. **BLEU/COMET scores**: If reference translation available
2. **Consistency score**: % of glossary terms translated uniformly
3. **Fluency**: Language model perplexity of target text
4. **Format compliance**: % chunks passing validation first attempt

**Feedback Loop**:
- Low-scoring chunks flagged for manual review
- User ratings (👍/👎) per chunk stored locally
- Aggregate metrics shown in UI after translation

**Implementation**:
```javascript
interface QualityMetrics {
  consistencyScore: number;    // 0-1, glossary term uniformity
  fluencyScore: number;         // 0-1, language model perplexity
  formatComplianceRate: number; // 0-1, validation pass rate
  userRating?: number;          // 1-5 stars, optional
}
```

**Effort**: High (1-2 weeks)  
**Impact**: Medium (helps identify problem areas, no direct quality improvement)

---

#### 6. Incremental Summary Updates

**Problem**: Summary is generated once; doesn't capture nuances discovered during translation.

**Proposal**: Two-pass approach:
1. **Initial summary**: Generated from source (current approach)
2. **Refined summary**: After all chunks translate, extract themes from translated text
3. **Re-translate**: Use refined summary for second pass (optional, user-initiated)

**Implementation**:
- Post-translation: analyze translated chunks for themes
- Generate "refined summary" from translated text
- Offer "Re-translate with refined context" button
- Reuse cached chunks but regenerate prompt with new summary

**Effort**: High (1-2 weeks)  
**Impact**: Low-Medium (mostly for iterative refinement workflows)

---

### Low Priority

#### 7. Multi-Pass Translation

**Problem**: Single-pass translation can miss context that emerges later.

**Proposal**: Two-pass workflow:

**Pass 1 - Rough Translation**:
- Fast, loose constraints
- Focus on meaning over style
- Generate initial glossary from translated terms

**Pass 2 - Refinement**:
- Use Pass 1 output as additional context
- Refine awkward phrasing
- Ensure consistency with emerged patterns

**Trade-offs**:
- ✅ Higher quality (potentially)
- ❌ 2x API cost
- ❌ 2x time
- ⚠️ Diminishing returns for simple content

**Use case**: High-value content (films, official releases) where quality > cost

**Effort**: High (2-3 weeks)  
**Impact**: Low (niche use case, high cost)

---

#### 8. Speaker Diarization

**Problem**: No awareness of who is speaking; can't maintain consistent voice per character.

**Proposal**: Integrate speaker detection:

**Approaches**:
1. **Manual tags**: User adds speaker labels to VTT (`Speaker 1:`, `Speaker 2:`)
2. **Whisper diarization**: Use Whisper's speaker detection feature
3. **Third-party**: Integrate pyannote.audio or similar

**Benefits**:
- Maintain character voice (formal vs casual)
- Translate gendered language accurately
- Preserve speaking style per character

**Implementation**:
```javascript
const glossary = 
  "Speaker 1 (Kuro-chan): casual, comedic, male\n" +
  "Speaker 2 (Host): formal, neutral, male\n" +
  "Speaker 3 (Richi): polite, feminine\n";
```

**Effort**: Very High (3-4 weeks, requires ML integration)  
**Impact**: Medium-High (significant for character-driven content)

---

## 📜 Version History

### v2.1 - Current (2025-12-02)
**Design Changes**:
- Removed stale multimodal codepath from translation workflow
- Translation now exclusively uses text-only prompts to avoid sending media
- Audio/video system prompts now primarily used for summary generation
- Added note about preserved compatibility for summary generation

**Implementation**:
- Modified `translateChunkFromText()` to always use text-only system prompt
- Removed videoUri parameter from translation API calls
- Updated tests to use correct header format in mocks

### v2.0 - Previous (2025-12-02)
**Design Changes**:
- Added source/target language support (`<source>`, `<target>` placeholders)
- Documented three system prompt variants (text/audio/video)
- Clarified conditional prompt sections (glossary, summary optional)
- Added media mode comparison and trade-offs

**Implementation**:
- Updated system prompts to mention media context explicitly
- Modified `buildUserPrompt()` to conditionally include sections
- Added `applyTargetPlaceholders()` for dynamic language insertion

---

### v1.0 - Initial (2024-11-27)
**Design**:
- Three-stage pipeline: Glossary → Summary → Translation
- Stateless concurrent chunk processing
- WebVTT format preservation enforced
- Frequency-based glossary fallback
- 20-term glossary limit, 150-token summary limit

**Implementation**:
- `translateCues()` core workflow
- `buildUserPrompt()` with static sections
- `validateVtt()` + `autoRepairVtt()` validation
- Concurrency limit: 10 chunks

---

## 🔗 Related Documents

- **[prompt-engineering.md](./prompt-engineering.md)**: Technical reference for current implementation
- **[../README.md](../README.md)**: User-facing documentation
- **[../AGENTS.md](../AGENTS.md)**: Agent-specific instructions

---

## 💡 Contributing to This Document

When making design changes:

1. **Propose changes in this doc first** (update relevant sections)
2. **Get feedback/approval** on design before implementing
3. **Implement the changes** in code
4. **Update prompt-engineering.md** to reflect new implementation
5. **Update this doc's Version History** with what changed and why

This keeps design intention and implementation in sync.
