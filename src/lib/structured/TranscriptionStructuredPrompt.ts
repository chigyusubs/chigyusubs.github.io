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

TIMESTAMP FORMAT: Use HH:MM:SS.mmm format where:
- HH = hours (always 2 digits, e.g., 00)
- MM = minutes (always 2 digits)
- SS = seconds (always 2 digits)
- mmm = milliseconds (always 3 digits)
Use at least 100ms precision. DO NOT collapse to whole seconds; keep the .mmm component (e.g., 00:01:05.100). Example: "00:00:03.483" NOT "00:03:483" or "00:03.483"

TEXT FORMAT RULES:
1. Write Japanese text naturally WITHOUT spaces between characters
   CORRECT: "バンジージャンプがギリギリ地面って書いてるやつ"
   WRONG: "バンジー ジャンプ が ギリギリ 地面 って 書い てるやつ"

2. Natural Japanese uses spaces only:
   - After punctuation (。、)
   - Between distinct phrases (rare)
   NOT between every character or word

3. Keep sentences together in one cue when possible
   - Don't break mid-sentence unless speaker changes
   - Typical cue length: 1.2s–6s. Avoid <1s unless it is an SFX or single short reaction.
   - Limit total cues in this chunk to 120. Merge tiny interjections into surrounding speech.
   - Keep each cue under ~200 Japanese characters. Do NOT pad with filler. If a speaker drags a filler (まあまあまあ...), collapse to 1–2 natural repeats; never loop or spam the same token inside a cue.

4. Timing bounds:
   - All start/end times must stay within ${context.videoStart} - ${context.videoEnd}.
   - If a timestamp would be outside this window, drop or adjust the cue to fit inside.

Include sound effects in parentheses: (音楽), (拍手), (笑い)

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
      "text": "Japanese subtitle text here"
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

TIMESTAMP FORMAT: Use HH:MM:SS.mmm format where:
- HH = hours (always 2 digits, e.g., 00)
- MM = minutes (always 2 digits)
- SS = seconds (always 2 digits)
- mmm = milliseconds (always 3 digits)
Use at least 100ms precision. DO NOT collapse to whole seconds; keep the .mmm component (e.g., 00:01:05.100). Example: "00:00:03.483" NOT "00:03:483" or "00:03.483"

TEXT FORMAT RULES:
1. Write Japanese text naturally WITHOUT spaces between characters
   CORRECT: "バンジージャンプがギリギリ地面って書いてるやつ"
   WRONG: "バンジー ジャンプ が ギリギリ 地面 って 書い てるやつ"

2. Natural Japanese uses spaces only:
   - After punctuation (。、)
   - Between distinct phrases (rare)
   NOT between every character or word

3. Keep sentences together in one cue when possible
   - Don't break mid-sentence unless speaker changes
   - Typical cue length: 1.2s–6s. Avoid <1s unless it is an SFX or single short reaction.
   - Limit total cues in this chunk to 120. Merge tiny interjections into surrounding speech.
   - Keep each cue under ~200 Japanese characters. Do NOT pad with filler. If a speaker drags a filler (まあまあまあ...), collapse to 1–2 natural repeats; never loop or spam the same token inside a cue.

4. Timing bounds:
   - All start/end times must stay within ${context.videoStart} - ${context.videoEnd}.
   - If a timestamp would be outside this window, drop or adjust the cue to fit inside.

Include sound effects in parentheses: (音楽), (拍手), (笑い)

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
      "text": "Japanese subtitle text here"
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
