import {
  DEFAULT_SYSTEM_PROMPT_AUDIO,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_SYSTEM_PROMPT_VIDEO,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_USER_PROMPT_STRUCTURE,
} from "../config/defaults";

export function systemPromptTextOnly(custom: string | undefined): string {
  if (custom?.trim()) return custom.trim();
  return DEFAULT_SYSTEM_PROMPT_TEXT;
}

export function systemPromptMultimodal(
  custom: string | undefined,
  mediaKind: "audio" | "video",
): string {
  // Only used when the internal multimodal translation path attaches media; no UI expose.
  const base =
    mediaKind === "audio"
      ? DEFAULT_SYSTEM_PROMPT_AUDIO
      : DEFAULT_SYSTEM_PROMPT_VIDEO;
  if (custom?.trim()) return custom.trim();
  return base;
}

export function glossarySystemPrompt(
  custom: string | undefined,
  targetLang: string,
): string {
  const template = (custom?.trim() || DEFAULT_GLOSSARY_PROMPT).trim();
  return applyTargetPlaceholders(template, targetLang);
}

export function summarySystemPrompt(
  custom: string | undefined,
  targetLang: string,
  fileLabel: string,
): string {
  const template = (custom?.trim() || DEFAULT_SUMMARY_PROMPT).trim();
  return applyFilePlaceholders(
    applyTargetPlaceholders(template, targetLang),
    fileLabel,
  );
}

export function buildUserPrompt(
  targetLang: string,
  glossary: string | undefined,
  context: string,
  chunk: string,
  summaryText?: string,
  useGlossary?: boolean,
): string {
  const structure = DEFAULT_USER_PROMPT_STRUCTURE;
  const parts: string[] = [];
  const expand = (text: string) => applyTargetPlaceholders(text, targetLang);

  if (useGlossary !== false && glossary?.trim()) {
    parts.push(`${expand(structure.glossaryHeader)}\n${glossary.trim()}`);
  }

  if (summaryText?.trim()) {
    parts.push(`${expand(structure.summaryHeader)}\n${summaryText.trim()}`);
  }

  if (context.trim()) {
    parts.push(`${expand(structure.contextHeader)}\n${context.trim()}`);
  }

  parts.push(`${expand(structure.chunkHeader)}\n${chunk.trim()}`);

  return parts.join("\n\n");
}

function applyTargetPlaceholders(template: string, targetLang: string): string {
  return template.replace(/<target>/g, targetLang);
}

function applyFilePlaceholders(template: string, fileLabel: string): string {
  return template.replace(/<file>/g, fileLabel);
}

export function buildSummaryUserPrompt(
  template: string,
  targetLang: string,
  replacements: { text?: string; glossary?: string },
): string {
  let prompt = template;
  prompt = prompt.replace(/<glossary>/g, replacements.glossary ?? "");
  prompt = prompt.replace(/<text>/g, replacements.text ?? "");
  return applyTargetPlaceholders(prompt, targetLang);
}
