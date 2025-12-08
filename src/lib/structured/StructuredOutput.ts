
/**
 * Types and validation for Structured JSON Translation.
 */

export type StructuredTranslationItem = {
    ids: number[];
    text: string;
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

        if (!Array.isArray(item.ids) || item.ids.some(id => typeof id !== "number")) {
            throw new Error(`Item at index ${i} has invalid 'ids' (must be number[])`);
        }

        if (typeof item.text !== "string") {
            // Allow empty string, but must be string
            if (item.text === undefined || item.text === null) {
                // Auto-repair null/undefined to empty string for robustness
                item.text = "";
            } else {
                throw new Error(`Item at index ${i} has invalid 'text' (must be string)`);
            }
        }

        translations.push({
            ids: item.ids as number[],
            text: String(item.text)
        });
    }

    return { translations };
}
