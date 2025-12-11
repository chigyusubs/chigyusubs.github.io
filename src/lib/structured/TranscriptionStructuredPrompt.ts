/**
 * Build prompts for structured transcription
 *
 * Generates system and user prompts for Gemini transcription with
 * context handoff between chunks and adaptive break point suggestions.
 */

import type { TranscriptionCue } from "./TranscriptionStructuredOutput";

export type TranscriptionPromptContext = {
  isFirstChunk: boolean;
  videoStart: string;       // HH:MM:SS.mmm
  videoEnd: string;         // HH:MM:SS.mmm
  breakWindowStart: string; // HH:MM:SS.mmm (last 20s of chunk)
  breakWindowEnd: string;   // HH:MM:SS.mmm (same as videoEnd)
  lastTwoCues?: TranscriptionCue[];  // Context from previous chunk
  nextCueNumber: number;    // Where to start numbering
};

// Shared prompt sections to avoid duplication
const TIMESTAMP_FORMAT = `TIMESTAMP FORMAT: Use HH:MM:SS.mmm format where:
- HH = hours (always 2 digits, e.g., 00)
- MM = minutes (always 2 digits)
- SS = seconds (always 2 digits)
- mmm = milliseconds (always 3 digits)
Use at least 100ms precision. DO NOT collapse to whole seconds; keep the .mmm component (e.g., 00:01:05.100).
Example: "00:00:03.483" NOT "00:03:483" or "00:03.483"`;

const TEXT_FORMAT_RULES = `TEXT FORMAT RULES:
1. Write Japanese text naturally WITHOUT spaces between characters
   CORRECT: "バンジージャンプがギリギリ地面って書いてるやつ"
   WRONG: "バンジー ジャンプ が ギリギリ 地面 って 書い てるやつ"

2. Natural Japanese uses spaces only after punctuation (。、) or between distinct phrases (rare).

3. Cue length and splitting:
   - Target 2-5 seconds per cue. Never exceed 6s.
   - Split at natural pause points: clause boundaries (が、けど、て), breaths, commas.
   - It's OK to split mid-sentence if it improves readability.
   - Keep dialogue to 1-2 lines (~80 chars). Annotations don't count toward this.
   - Avoid <1.5s cues unless pure SFX or single-word reactions.
   - Limit total cues per chunk to 120.

4. Anti-looping: If a speaker drags filler (まあまあまあ...), collapse to 1-2 natural repeats.
   Never emit 2 identical consecutive cues.`;

const TIMING_RULES = (videoStart: string, videoEnd: string) => `TIMING RULES:
- All cues must have start < end (no zero-length or negative duration).
- Cues must be strictly increasing (no overlaps).
- All times must stay within ${videoStart} - ${videoEnd}.
- If a timestamp would be outside this window, drop or adjust the cue.`;

const INLINE_ANNOTATIONS = `INLINE ANNOTATIONS (include in cue text for translation context):
- Speaker change: Mark with "(--)" at start of cue when speaker changes.
- On-screen text: Important telops/captions: "(テロップ: 衝撃の事実!)"
- Sound effects: (拍手), (笑い), (音楽)
Only annotate when it adds meaning. Don't over-annotate.`;

/**
 * Build transcription prompts for a chunk
 *
 * @param context - Context including chunk boundaries, previous cues, and numbering
 * @returns System prompt and user prompt for Gemini API
 */
export function buildTranscriptionPrompt(context: TranscriptionPromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a professional Japanese transcriber. Output structured subtitle data as JSON following the provided schema. Focus on accuracy, natural phrasing, and identifying good break points for the next chunk.`;

  let userPrompt = "";

  if (context.isFirstChunk) {
    userPrompt = `Transcribe this Japanese video segment to structured subtitle data.

This is the first chunk starting at 00:00:00.000.

VIDEO SEGMENT: ${context.videoStart} to ${context.videoEnd}

${TIMESTAMP_FORMAT}

${TEXT_FORMAT_RULES}

${TIMING_RULES(context.videoStart, context.videoEnd)}

${INLINE_ANNOTATIONS}

Start cue numbering at: ${context.nextCueNumber}

Suggest a natural break point between ${context.breakWindowStart} and ${context.breakWindowEnd} based on:
- Pause after punchline
- Scene change
- Topic shift
- Speaker change

OUTPUT FORMAT - Return JSON with this structure:
{
  "cues": [
    {
      "number": 1,
      "startTime": "00:00:03.483",
      "endTime": "00:00:06.120",
      "text": "(--) Japanese subtitle text here"
    }
  ],
  "suggestedNextBreak": "00:01:45.000",
  "breakReason": "scene_change",
  "lastTwoCues": [
    // Copy the last 2 cues from the cues array for context handoff
  ]
}

IMPORTANT: Return ONLY the JSON object, no additional text or markdown.`;
  } else {
    // Build context section from last two cues
    const contextSection = context.lastTwoCues
      ?.map(cue => `[Cue ${cue.number}] ${cue.startTime} - ${cue.endTime}\n${cue.text}`)
      .join("\n\n") || "";

    const lastCueEndTime = context.lastTwoCues?.[context.lastTwoCues.length - 1]?.endTime || context.videoStart;

    userPrompt = `Transcribe this Japanese video segment to structured subtitle data.

VIDEO SEGMENT: ${context.videoStart} to ${context.videoEnd}

CONTEXT (already transcribed, for reference only):
${contextSection}

BEGIN TRANSCRIPTION from ${lastCueEndTime}
Start cue numbering at: ${context.nextCueNumber}

${TIMESTAMP_FORMAT}

${TEXT_FORMAT_RULES}

${TIMING_RULES(context.videoStart, context.videoEnd)}

${INLINE_ANNOTATIONS}

Suggest a natural break point between ${context.breakWindowStart} and ${context.breakWindowEnd} based on:
- Pause after punchline
- Scene change
- Topic shift
- Speaker change

OUTPUT FORMAT - Return JSON with this structure:
{
  "cues": [
    {
      "number": ${context.nextCueNumber},
      "startTime": "00:00:03.483",
      "endTime": "00:00:06.120",
      "text": "(--) Japanese subtitle text here"
    }
  ],
  "suggestedNextBreak": "00:01:45.000",
  "breakReason": "scene_change",
  "lastTwoCues": [
    // Copy the last 2 cues from the cues array for context handoff
  ]
}

IMPORTANT: Return ONLY the JSON object, no additional text or markdown.`;
  }

  return { systemPrompt, userPrompt };
}
