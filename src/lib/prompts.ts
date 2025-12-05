import {
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_USER_PROMPT_STRUCTURE,
} from "../config/defaults";

export function systemPromptTextOnly(custom: string | undefined): string {
  if (custom?.trim()) return custom.trim();
  return DEFAULT_SYSTEM_PROMPT_TEXT;
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
  const sections: string[] = [];
  const expand = (text: string) => applyTargetPlaceholders(text, targetLang);

  if (useGlossary !== false && glossary?.trim()) {
    sections.push(`${expand(structure.glossaryHeader)}\n${glossary.trim()}`);
  }

  if (summaryText?.trim()) {
    sections.push(`${expand(structure.summaryHeader)}\n${summaryText.trim()}`);
  }

  if (context.trim()) {
    sections.push(`${expand(structure.contextHeader)}\n${context.trim()}`);
  }

  if (chunk) {
    // Count cues to help with the "missing last cue" issue
    const cues = chunk.trim();
    const cueCount = cues.split(/\n\s*\n/).filter(cue =>
      cue.includes(" --> ") && cue.includes("\n")
    ).length;

    // Extract the last cue timecode to emphasize it must be included
    const allCues = cues.split(/\n\s*\n/).filter(cue =>
      cue.includes(" --> ") && cue.includes("\n")
    );
    const lastCue = allCues.length > 0 ? allCues[allCues.length - 1] : "";
    const lastTimecodeMatch = lastCue.match(/^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\s*\n/);
    const lastEndTimestamp = lastTimecodeMatch ? lastTimecodeMatch[2] : "unknown";

    sections.push(
      `${expand(structure.chunkHeader)}`,
      cues,
      `---`,
      `IMPORTANT: Translate ALL cues above. Output exactly ${cueCount} cues in WebVTT format.`,
      `CRITICAL: Your response must end with a cue that ends at timecode ${lastEndTimestamp}.`,
      `Do NOT truncate or omit the final cue in the input.`
    );
  }

  return sections.join("\n\n");
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
