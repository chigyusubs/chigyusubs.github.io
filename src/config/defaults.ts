export const DEFAULT_MODELS = [
  "models/gemini-2.5-pro",
  "models/gemini-2.5-flash",
];
export const DEFAULT_MODEL = DEFAULT_MODELS[0];

export const DEFAULT_USE_AUDIO_ONLY = true;
export const DEFAULT_USE_SUMMARY = true;
export const DEFAULT_USE_GLOSSARY = true;

export const DEFAULT_SOURCE_LANG = "ja";
export const DEFAULT_TARGET_LANG = "en";
export const DEFAULT_STYLE = "natural";
export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_CHUNK_SECONDS = 600;
export const DEFAULT_OVERLAP_CUES = 2;
export const DEFAULT_TEMPERATURE = 0.2;
export const MAX_CONCURRENCY = 10;

// Token estimation helpers (approximate)
export const VIDEO_TOKENS_PER_SEC_DEFAULT = 300; // ~258 visual + ~32 audio
export const VIDEO_TOKENS_PER_SEC_LOW = 100; // low media resolution
export const AUDIO_TOKENS_PER_SEC = 32;
export const DEFAULT_SYSTEM_PROMPT =
  "You are a professional subtitle translator. Translate only the provided cues; do not add or invent cues. Keep timecodes and line breaks exactly. Preserve WEBVTT formatting (timecode lines + cue text). Do not change cue timings, headers, or structure. Do not echo acknowledgments or filler.";

export const DEFAULT_SUMMARY_PROMPT =
  'You are summarizing media to aid subtitle translation. Identify major sections/acts in the timeline and produce 2-3 concise bullets per section. For each section, capture: key speakers/entities, tone shifts, and recurring on-screen text or jokes. Only include locations/scenes if explicitly stated; otherwise say "unknown." Do NOT guess locations. Label sections clearly (e.g., "Section 1:", "Section 2:"). Do NOT fabricate; if unsure, say "unknown". Keep the whole summary short.';

export const DEFAULT_GLOSSARY_PROMPT =
  "Extract a concise glossary from the provided subtitles. Translate each term into the target language. Focus on proper nouns, names, recurring terms, and on-screen text that should remain consistent. Output CSV lines: source,target. Do not add explanations. Include only entries that appear in the text.";

export const DEFAULT_SYSTEM_PROMPT_TEXT =
  "You are a professional subtitle translator. Output MUST be valid WebVTT cues with UNCHANGED timecodes.\n" +
  "Rules:\n" +
  "- Preserve timing and line breaks exactly as in the input cues.\n" +
  "- Do NOT add, remove, merge, or split cues.\n" +
  "- Keep speaker tags and [SFX] markers; do not translate inside square brackets.\n" +
  "- Every cue must contain translated text; never leave cue text blank.\n" +
  "- If unsure, choose the most natural target-language phrasing without adding content.\n" +
  "- Return ONLY the WebVTT cues. No explanations, no headers unless present in input.";

export const DEFAULT_SYSTEM_PROMPT_VIDEO =
  "You are a professional subtitle translator. Use the attached video only to disambiguate tone, sarcasm, laughter, and on-screen captions. " +
  "Keep timing and line breaks EXACTLY as provided. Do NOT invent content or change any timecodes. Translate ONLY the supplied cues; do not add new cues or text outside the provided timecodes. Every cue must contain translated text; never leave cue text blank. Do NOT echo acknowledgments or filler. Output ONLY WebVTT cues (no extra text).";

export const DEFAULT_SYSTEM_PROMPT_AUDIO =
  "You are a professional subtitle translator. Audio-only context is provided; use it only to resolve tone and meaning. " +
  "Keep timing and line breaks EXACTLY as provided. Do NOT invent content or change any timecodes. Translate ONLY the supplied cues; do not add new cues or text outside the provided timecodes. Every cue must contain translated text; never leave cue text blank. Do NOT echo acknowledgments or filler. Output ONLY WebVTT cues (no extra text).";

export const PROMPT_PRESETS = {
  general: {
    name: "General Purpose",
    systemText: DEFAULT_SYSTEM_PROMPT_TEXT,
    systemVideo: DEFAULT_SYSTEM_PROMPT_VIDEO,
    systemAudio: DEFAULT_SYSTEM_PROMPT_AUDIO,
    summary: DEFAULT_SUMMARY_PROMPT,
    glossary: DEFAULT_GLOSSARY_PROMPT,
  },
  variety: {
    name: "Japanese Variety (ChigyuSubs)",
    systemText:
      "You are a professional subtitle translator for Japanese Variety Shows. Output MUST be valid WebVTT cues with UNCHANGED timecodes.\n" +
      "Rules:\n" +
      "- Preserve timing and line breaks exactly.\n" +
      "- Capture the comedic tone, including sarcasm and 'Tsukkomi' (retorts).\n" +
      "- Do NOT add, remove, merge, or split cues.\n" +
      "- Keep speaker tags and [SFX] markers; do not translate inside square brackets.\n" +
      "- Every cue must contain translated text; never leave cue text blank.\n" +
      "- Return ONLY the WebVTT cues. No explanations.",
    systemVideo:
      "You are a professional subtitle translator for Japanese Variety Shows. Use the video to understand the visual comedy, physical gags, and on-screen text. " +
      "Keep timing and line breaks EXACTLY as provided. Translate ONLY the supplied cues. Capture the energy and nuance of the original performance. Every cue must contain translated text. Output ONLY WebVTT cues.",
    systemAudio:
      "You are a professional subtitle translator for Japanese Variety Shows. Use the audio to hear intonation, laughter, and delivery speed. " +
      "Keep timing and line breaks EXACTLY as provided. Translate ONLY the supplied cues. Reflect the speaker's emotion and comedic timing. Every cue must contain translated text. Output ONLY WebVTT cues.",
    summary:
      'You are summarizing a Japanese Variety Show to aid subtitle translation. Identify major segments, comedic beats, and recurring gags. For each section, capture: key speakers (including "Boke" and "Tsukkomi" roles if clear), tone shifts, and on-screen text jokes. Label sections clearly. Do NOT fabricate; if unsure, say "unknown". Keep it concise.',
    glossary:
      "Extract a concise glossary from the provided subtitles. Focus on show-specific catchphrases, nicknames, and recurring terminology. Translate each term into the target language. Output CSV lines: source,target. Do not add explanations. Include only entries that appear in the text.",
  },
} as const;

export type PromptPresetId = keyof typeof PROMPT_PRESETS;
