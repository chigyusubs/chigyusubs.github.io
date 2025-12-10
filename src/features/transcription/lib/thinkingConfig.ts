import type { GenerateRequest } from "../../../lib/providers/types";

/**
 * Choose the correct thinking configuration based on the Gemini model generation.
 * Gemini 3 prefers thinkingLevel (low/high). Older models use thinkingBudget.
 */
export function buildGeminiThinkingConfig(
  modelName: string,
  thinkingBudget?: number,
  thinkingLevel?: "low" | "high"
): GenerateRequest["thinkingConfig"] | undefined {
  const normalized = modelName.includes("/")
    ? modelName.split("/").pop() || modelName
    : modelName;
  const isGemini3 = normalized.toLowerCase().includes("gemini-3");

  if (isGemini3) {
    if (thinkingLevel) {
      return { thinkingLevel };
    }
    // Leave undefined to use the model default (high/dynamic)
    return undefined;
  }

  if (typeof thinkingBudget === "number") {
    return { thinkingBudget };
  }

  return undefined;
}
