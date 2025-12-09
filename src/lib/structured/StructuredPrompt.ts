
import type { Cue } from "../vtt";
import { formatTimestamp } from "./TranscriptionVttReconstructor";

export type StructuredCueHintMode = "duration" | "short-tag";
export const DEFAULT_STRUCTURED_CUE_HINT_MODE: StructuredCueHintMode = "duration";

const SHORT_CUE_SECONDS = 1.5;

/**
 * Generates the user prompt for Structured JSON Translation.
 */
export function buildStructuredUserPrompt(
  cues: Cue[],
  targetLang: string,
  glossary: string | undefined,
  context: string,
  summaryText: string | undefined,
  hintMode: StructuredCueHintMode = "duration",
): string {
  const lines: string[] = [];

  // 1. Glossary Section
  if (glossary?.trim()) {
    lines.push(`### GLOSSARY ###`);
    lines.push(glossary.trim());
    lines.push("");
  }

  // 2. Summary Section
  if (summaryText?.trim()) {
    lines.push(`### GLOBAL SUMMARY ###`);
    lines.push(summaryText.trim());
    lines.push("");
  }

  // 3. Context Section
  if (context.trim()) {
    lines.push(`### PREVIOUS CONTEXT (REFERENCE ONLY) ###`);
    lines.push(context.trim());
    lines.push("");
  }

  // 4. Cues Section
  lines.push(`### CUES TO TRANSLATE ###`);
  if (hintMode === "short-tag") {
    lines.push(
      `Format: [ID <id>][SHORT?] <start> --> <end> <source_text>`,
    );
  } else {
    lines.push(
      `Format: [ID <id>] <start> --> <end> (duration <seconds>s) <source_text>`,
    );
  }
  lines.push(`---`);

  cues.forEach((cue, idx) => {
    const id = idx + 1; // 1-based IDs to avoid off-by-one confusion
    const durationSeconds = cue.end - cue.start;
    const start = formatTimestamp(cue.start);
    const end = formatTimestamp(cue.end);
    const safeText = cue.text.replace(/\n/g, " ");
    if (hintMode === "short-tag") {
      const shortTag = durationSeconds < SHORT_CUE_SECONDS ? "[SHORT]" : "";
      lines.push(
        `[ID ${id}]${shortTag ? ` ${shortTag}` : ""} ${start} --> ${end} ${safeText}`,
      );
    } else {
      lines.push(
        `[ID ${id}] ${start} --> ${end} (duration ${durationSeconds.toFixed(2)}s) ${safeText}`,
      );
    }
  });

  lines.push(`---`);
  lines.push(`Task: Translate the above cues into ${targetLang}.`);
  lines.push("");
  lines.push(`Rules (keep it minimal):`);
  lines.push(`1. Output a JSON object with a "translations" array.`);
  lines.push(
    `2. Each item must have "id" (number) and "text" (string). Optional: "merge_with_next": true to merge with the next cue.`,
  );
  if (hintMode === "short-tag") {
    lines.push(
      `3. Only merge when a cue is marked [SHORT] and clearly flows into the next cue; set merge_with_next: true on that cue and return "" for the next cue's text.`,
    );
  } else {
    lines.push(
      `3. You MAY merge very short adjacent cues; set merge_with_next: true on the first cue of the merged group; later cues in that group can have empty text.`,
    );
  }
  lines.push(
    `4. Keep cues in order. Do NOT drop or duplicate any IDs. One output item per input ID.`,
  );
  lines.push(`5. Do NOT split a single cue across multiple outputs.`);
  lines.push(``);
  lines.push(`Example Output:`);
  lines.push(`{`);
  lines.push(`  "translations": [`);
  lines.push(`    { "id": 1, "text": "Translated text...", "merge_with_next": false },`);
  lines.push(`    { "id": 2, "text": "Combined with next", "merge_with_next": true },`);
  lines.push(`    { "id": 3, "text": "" }`);
  lines.push(`  ]`);
  lines.push(`}`);

  return lines.join("\n");
}
