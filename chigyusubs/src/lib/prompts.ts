import {
  DEFAULT_SYSTEM_PROMPT_AUDIO,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_SYSTEM_PROMPT_VIDEO,
} from "../config/defaults";

export function systemPromptTextOnly(custom: string | undefined): string {
  if (custom?.trim()) return custom.trim();
  return DEFAULT_SYSTEM_PROMPT_TEXT;
}

export function systemPromptMultimodal(
  custom: string | undefined,
  mediaKind: "audio" | "video",
): string {
  const base =
    mediaKind === "audio"
      ? DEFAULT_SYSTEM_PROMPT_AUDIO
      : DEFAULT_SYSTEM_PROMPT_VIDEO;
  if (custom?.trim()) return custom.trim();
  return base;
}

export function buildUserPrompt(
  sourceLang: string,
  targetLang: string,
  style: string,
  glossary: string | undefined,
  context: string,
  chunk: string,
  summaryText?: string,
  useGlossary?: boolean,
): string {
  const parts: string[] = [];

  // 1. Language Header
  parts.push(`LANGUAGE: ${sourceLang} → ${targetLang}`);

  // 2. Style (optional)
  if (style.trim()) {
    parts.push(`STYLE: ${style.trim()}`);
  }

  // 3. Glossary (optional)
  if (useGlossary !== false && glossary?.trim()) {
    parts.push(`GLOSSARY (source->target):\n${glossary.trim()}`);
  }

  // 4. Summary (optional)
  if (summaryText?.trim()) {
    parts.push(`SUMMARY:\n${summaryText.trim()}`);
  }

  // 5. Context (optional)
  if (context.trim()) {
    parts.push(`PREVIOUS CONTEXT (do not re-emit):\n${context.trim()}`);
  }

  // 6. Chunk (required)
  parts.push(`CUES TO TRANSLATE:\n${chunk.trim()}`);

  return parts.join("\n\n");
}
