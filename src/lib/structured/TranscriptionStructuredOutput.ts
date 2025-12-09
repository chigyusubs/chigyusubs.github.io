/**
 * TypeScript types and JSON schema for structured transcription output
 *
 * This module defines the shape of transcription data returned by Gemini
 * when using structured output mode with responseSchema.
 */

export type TranscriptionCue = {
  number: number;
  startTime: string;  // HH:MM:SS.mmm or seconds with 1-3 decimals
  endTime: string;    // HH:MM:SS.mmm or seconds with 1-3 decimals
  text: string;
};

export type BreakReason =
  | "pause_after_punchline"
  | "scene_change"
  | "topic_shift"
  | "natural_conversation_break"
  | "speaker_change";

export type StructuredTranscriptionOutput = {
  cues: TranscriptionCue[];
  suggestedNextBreak: string;  // HH:MM:SS.mmm format
  breakReason: BreakReason;
  lastTwoCues: TranscriptionCue[];  // Exactly 2 cues for context handoff
};

/**
 * JSON Schema for Gemini's responseSchema parameter
 * Enforces strict structured output
 */
export const TRANSCRIPTION_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    cues: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          number: { type: "integer" as const },
          startTime: {
            type: "string" as const,
            pattern: "^(\\d{2}:\\d{2}:\\d{2}\\.\\d{3}|\\d{1,4}(?:\\.\\d{1,3})?)$",
            description: "HH:MM:SS.mmm with >=100ms resolution (preferred), or seconds with 1-3 decimals; keep fractional part (e.g., 00:01:05.100 or 65.100)"
          },
          endTime: {
            type: "string" as const,
            pattern: "^(\\d{2}:\\d{2}:\\d{2}\\.\\d{3}|\\d{1,4}(?:\\.\\d{1,3})?)$",
            description: "HH:MM:SS.mmm with >=100ms resolution (preferred), or seconds with 1-3 decimals; keep fractional part (e.g., 00:01:05.100 or 65.100)"
          },
          text: { type: "string" as const }
        },
        required: ["number", "startTime", "endTime", "text"]
      }
    },
    suggestedNextBreak: {
      type: "string" as const,
      pattern: "^\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$"
    },
    breakReason: {
      type: "string" as const,
      enum: [
        "pause_after_punchline",
        "scene_change",
        "topic_shift",
        "natural_conversation_break",
        "speaker_change"
      ]
    },
    lastTwoCues: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          number: { type: "integer" as const },
          startTime: { type: "string" as const },
          endTime: { type: "string" as const },
          text: { type: "string" as const }
        },
        required: ["number", "startTime", "endTime", "text"]
      },
      minItems: 2,
      maxItems: 2
    }
  },
  required: ["cues", "suggestedNextBreak", "breakReason", "lastTwoCues"]
};

/**
 * Validate structured transcription output from Gemini
 *
 * @param data - Raw data from model response
 * @returns Validated and typed transcription output
 * @throws Error if validation fails
 */
export function validateTranscriptionOutput(data: unknown): StructuredTranscriptionOutput {
  if (!data || typeof data !== "object") {
    throw new Error("Transcription output must be an object");
  }

  const obj = data as Record<string, unknown>;

  // Validate cues array
  if (!Array.isArray(obj.cues)) {
    throw new Error("Missing or invalid 'cues' array");
  }

  const cues: TranscriptionCue[] = [];
  for (let i = 0; i < obj.cues.length; i++) {
    const cue = obj.cues[i];
    if (!cue || typeof cue !== "object") {
      throw new Error(`Cue ${i} is not an object`);
    }

    const c = cue as Record<string, unknown>;

    if (typeof c.number !== "number") {
      throw new Error(`Cue ${i}: 'number' must be an integer`);
    }

    if (typeof c.startTime !== "string") {
      throw new Error(`Cue ${i}: 'startTime' must be a string`);
    }

    if (typeof c.endTime !== "string") {
      throw new Error(`Cue ${i}: 'endTime' must be a string`);
    }

    if (typeof c.text !== "string") {
      throw new Error(`Cue ${i}: 'text' must be a string`);
    }

    // Validate timestamp format (HH:MM:SS.mmm or seconds with 1-3 decimals)
    const timestampRegex = /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{1,4}(?:\.\d{1,3})?)$/;
    if (!timestampRegex.test(c.startTime)) {
      throw new Error(`Cue ${i}: 'startTime' format invalid (expected HH:MM:SS.mmm or seconds with 1-3 decimals)`);
    }

    if (!timestampRegex.test(c.endTime)) {
      throw new Error(`Cue ${i}: 'endTime' format invalid (expected HH:MM:SS.mmm or seconds with 1-3 decimals)`);
    }

    cues.push({
      number: c.number,
      startTime: c.startTime,
      endTime: c.endTime,
      text: c.text
    });
  }

  // Validate suggestedNextBreak
  if (typeof obj.suggestedNextBreak !== "string") {
    throw new Error("Missing or invalid 'suggestedNextBreak'");
  }

  const timestampRegex = /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{1,4}(?:\.\d{1,3})?)$/;
  if (!timestampRegex.test(obj.suggestedNextBreak)) {
    throw new Error("'suggestedNextBreak' format invalid (expected HH:MM:SS.mmm or seconds with 1-3 decimals)");
  }

  // Validate breakReason
  const validReasons: BreakReason[] = [
    "pause_after_punchline",
    "scene_change",
    "topic_shift",
    "natural_conversation_break",
    "speaker_change"
  ];

  if (typeof obj.breakReason !== "string" || !validReasons.includes(obj.breakReason as BreakReason)) {
    throw new Error(`'breakReason' must be one of: ${validReasons.join(", ")}`);
  }

  // Validate lastTwoCues array
  if (!Array.isArray(obj.lastTwoCues)) {
    throw new Error("Missing or invalid 'lastTwoCues' array");
  }

  if (obj.lastTwoCues.length !== 2) {
    throw new Error("'lastTwoCues' must have exactly 2 cues");
  }

  const lastTwoCues: TranscriptionCue[] = [];
  for (let i = 0; i < obj.lastTwoCues.length; i++) {
    const cue = obj.lastTwoCues[i];
    if (!cue || typeof cue !== "object") {
      throw new Error(`lastTwoCues[${i}] is not an object`);
    }

    const c = cue as Record<string, unknown>;

    if (typeof c.number !== "number") {
      throw new Error(`lastTwoCues[${i}]: 'number' must be an integer`);
    }

    if (typeof c.startTime !== "string") {
      throw new Error(`lastTwoCues[${i}]: 'startTime' must be a string`);
    }

    if (typeof c.endTime !== "string") {
      throw new Error(`lastTwoCues[${i}]: 'endTime' must be a string`);
    }

    if (typeof c.text !== "string") {
      throw new Error(`lastTwoCues[${i}]: 'text' must be a string`);
    }

    lastTwoCues.push({
      number: c.number,
      startTime: c.startTime,
      endTime: c.endTime,
      text: c.text
    });
  }

  return {
    cues,
    suggestedNextBreak: obj.suggestedNextBreak,
    breakReason: obj.breakReason as BreakReason,
    lastTwoCues
  };
}
