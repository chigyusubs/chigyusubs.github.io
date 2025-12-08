
import type { Cue } from "../vtt";
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_GLOSSARY_PROMPT } from "../../config/defaults";

/**
 * Generates the user prompt for Structured JSON Translation.
 */
export function buildStructuredUserPrompt(
    cues: Cue[],
    targetLang: string,
    glossary: string | undefined,
    context: string,
    summaryText: string | undefined,
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
    lines.push(`Format: [ID: <id>] (<duration_hint>) <source_text>`);
    lines.push(`---`);

    cues.forEach((cue, idx) => {
        // We use 1-based IDs for the LLM to avoid off-by-one confusion
        const id = idx + 1;
        const duration = cue.end - cue.start;
        const hint = getDurationHint(duration);
        lines.push(`[ID: ${id}] (${hint}) ${cue.text.replace(/\n/g, " ")}`);
    });

    lines.push(`---`);
    lines.push(`Task: Translate the above cues into ${targetLang}.`);

    lines.push("");
    lines.push(`Rules:`);
    lines.push(`1. Output a JSON object with a "translations" array.`);
    lines.push(`2. Each item must have "ids" (array of numbers) and "text" (translated string).`);
    lines.push(`3. You MAY merge adjacent cues if they are marked (Short) and form a complete phrase.`);
    lines.push(`4. Do NOT merge cues marked (Long) unless absolutely necessary.`);
    lines.push(`5. You strictly CANNOT split a single ID into multiple output items.`);
    lines.push(`6. Every Input ID must appear exactly once in the Output IDs.`);

    lines.push(``);
    lines.push(`Example Output:`);
    lines.push(`{`);
    lines.push(`  "translations": [`);
    lines.push(`    { "ids": [1], "text": "Translated text..." },`);
    lines.push(`    { "ids": [2, 3], "text": "Merged text..." }`);
    lines.push(`  ]`);
    lines.push(`}`);

    return lines.join("\n");
}

function getDurationHint(seconds: number): string {
    if (seconds < 1.5) return "Short";
    if (seconds > 5.0) return "Long";
    return "Medium";
}
