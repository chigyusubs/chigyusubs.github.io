export const DEFAULT_MODELS = [
  "models/gemini-2.5-pro",
  "models/gemini-2.5-flash",
];
export const DEFAULT_MODEL = DEFAULT_MODELS[0];

export const DEFAULT_USE_AUDIO_ONLY = true;
export const DEFAULT_USE_SUMMARY = true;
export const DEFAULT_USE_GLOSSARY = true;

export const DEFAULT_TARGET_LANG = "English";
export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_CHUNK_SECONDS = 600;
export const DEFAULT_OVERLAP_CUES = 2;
export const DEFAULT_TEMPERATURE = 0.2;
export const MAX_CONCURRENCY = 10;
// OpenAI transcription defaults (client-side chunking)
export const TRANSCRIPTION_DEFAULT_CHUNK_SECONDS = 600;
export const TRANSCRIPTION_MIN_CHUNK_SECONDS = 30;
export const TRANSCRIPTION_DEFAULT_CONCURRENCY = 2;
export const TRANSCRIPTION_MIN_CONCURRENCY = 1;
export const TRANSCRIPTION_MAX_CONCURRENCY = 4;
export const TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS = 20;
export const DEFAULT_TRANSCRIPTION_PROMPT =
  "Transcribe the attached media to WebVTT. Preserve original language and timing with accurate timestamps. Return ONLY WebVTT text.";
// Workflow modes
export const WORKFLOW_MODES = ["translation", "transcription"] as const;
export type WorkflowMode = (typeof WORKFLOW_MODES)[number];
export const DEFAULT_WORKFLOW_MODE: WorkflowMode = "translation";

// Token estimation helpers (approximate)
export const VIDEO_TOKENS_PER_SEC_DEFAULT = 300; // ~258 visual + ~32 audio
export const VIDEO_TOKENS_PER_SEC_LOW = 100; // low media resolution
export const AUDIO_TOKENS_PER_SEC = 32;
export const DEFAULT_SYSTEM_PROMPT =
  "You are a professional subtitle translator. Output MUST be valid WebVTT cues with UNCHANGED timecodes.\n" +
  "Rules:\n" +
  "- Preserve timing and line breaks exactly as in the input cues.\n" +
  "- Do NOT add, remove, merge, or split cues.\n" +
  "- Keep speaker tags and [SFX] markers; do not translate inside square brackets.\n" +
  "- Every cue must contain translated text; never leave cue text blank.\n" +
  "- If unsure, choose the most natural target-language phrasing without adding content.\n" +
  "- Return ONLY the WebVTT cues. No explanations, no headers unless present in input.\n\n";

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

export type SummaryUserPromptTemplates = {
  media: string;
  subtitles: string;
};

export const DEFAULT_SUMMARY_USER_PROMPT: SummaryUserPromptTemplates = {
  media:
    "<glossary>Use the attached media to produce a sectioned bullet summary as instructed. Respond ONLY with bullets grouped by section labels.",
  subtitles:
    "<glossary>Use the provided subtitles to produce a sectioned bullet summary as instructed. Text follows:\n\n<text>",
};

export type SummaryFileLabels = {
  media: string;
  transcript: string;
};

export const DEFAULT_SUMMARY_FILE_LABELS: SummaryFileLabels = {
  media: "a media file",
  transcript: "a transcript",
};

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

export type UserPromptStructure = {
  glossaryHeader: string;
  summaryHeader: string;
  contextHeader: string;
  chunkHeader: string;
};

export const DEFAULT_USER_PROMPT_STRUCTURE: UserPromptStructure = {
  glossaryHeader: "### GLOSSARY ###",
  summaryHeader: "### GLOBAL SUMMARY ###",
  contextHeader: "### PREVIOUS CONTEXT (REFERENCE ONLY, DO NOT TRANSLATE) ###",
  chunkHeader: "### CUES TO TRANSLATE ###",
};

export const DEFAULT_SYSTEM_PROMPT_TEXT =
  "You are a professional subtitle translator. Output MUST be valid WebVTT cues with UNCHANGED timecodes.\n" +
  "Rules:\n" +
  "- Preserve timing and line breaks exactly as in the input cues.\n" +
  "- Do NOT add, remove, merge, or split cues.\n" +
  "- Keep speaker tags and [SFX] markers; do not translate inside square brackets.\n" +
  "- Every cue must contain translated text; never leave cue text blank.\n" +
  "- If unsure, choose the most natural target-language phrasing without adding content.\n" +
  "- Return ONLY the WebVTT cues. No explanations, no headers unless present in input.\n\n";

export const STRUCTURED_SYSTEM_PROMPT =
  "You are a subtitle translator tool. Your task is to translate subtitles into <target>.\n" +
  "\n" +
  "Rules:\n" +
  "1. Output JSON with a \"translations\" array.\n" +
  "2. Each item: { \"id\": number, \"text\": string, \"merge_with_next\"?: boolean }.\n" +
  "3. Keep IDs in order, one item per input cue. Do not drop or duplicate IDs.\n" +
  "4. You MAY merge very short adjacent cues: set merge_with_next=true on the first cue of the merged group; later cues in that group can have empty text.\n" +
  "5. Never split a single cue across multiple outputs.";

export const PROMPT_PRESETS = {
  general: {
    name: "General Purpose (VTT)",
    systemText: DEFAULT_SYSTEM_PROMPT_TEXT,
    summary: DEFAULT_SUMMARY_PROMPT,
    glossary: DEFAULT_GLOSSARY_PROMPT,
  },
  structured: {
    name: "Structured JSON",
    systemText: STRUCTURED_SYSTEM_PROMPT,
    summary: DEFAULT_SUMMARY_PROMPT,
    glossary: DEFAULT_GLOSSARY_PROMPT,
  },
} as const;

export type PromptPresetId = keyof typeof PROMPT_PRESETS;
