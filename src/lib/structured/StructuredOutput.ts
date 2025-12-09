
/**
 * Types and validation for Structured JSON Translation.
 *
 * Minimal schema: one entry per cue with an optional merge flag so we can
 * reconstruct VTT timings based on the original cues.
 */

export type StructuredTranslationItem = {
  id: number;               // 1-based cue number
  text: string;             // translated text (can be empty but must be a string)
  merge_with_next?: boolean; // optional flag to merge this cue with the next one
};

export type StructuredTranslationOutput = {
  translations: StructuredTranslationItem[];
};

/**
 * Validates that an unknown object matches the StructuredTranslationOutput schema.
 * Throws a descriptive error if validation fails.
 */
export function validateStructuredOutput(data: unknown): StructuredTranslationOutput {
  if (!data || typeof data !== "object") {
    throw new Error("Output is not a valid JSON object");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.translations)) {
    throw new Error("Missing or invalid 'translations' array");
  }

  const translations: StructuredTranslationItem[] = [];

  for (let i = 0; i < obj.translations.length; i++) {
    const item = obj.translations[i] as Record<string, unknown>;

    if (!item || typeof item !== "object") {
      throw new Error(`Item at index ${i} is not an object`);
    }

    if (typeof item.id !== "number" || !Number.isFinite(item.id)) {
      throw new Error(`Item at index ${i} has invalid 'id' (must be number)`);
    }

    let textValue: string;
    if (typeof item.text === "string") {
      textValue = item.text;
    } else if (item.text === undefined || item.text === null) {
      // Auto-repair null/undefined to empty string for robustness
      textValue = "";
    } else {
      throw new Error(`Item at index ${i} has invalid 'text' (must be string)`);
    }

    if (
      item.merge_with_next !== undefined &&
      typeof item.merge_with_next !== "boolean"
    ) {
      throw new Error(
        `Item at index ${i} has invalid 'merge_with_next' (must be boolean)`,
      );
    }

    translations.push({
      id: item.id,
      text: textValue,
      merge_with_next: item.merge_with_next,
    });
  }

  return { translations };
}
