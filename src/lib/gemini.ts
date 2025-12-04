/**
 * Backward-compatible wrapper for the old gemini.ts API
 * This file maintains the original function signatures while delegating to the new provider system
 */
import { GeminiProvider, ProviderTranslationError } from "./providers";
import type { ProviderConfig, GenerateRequest, ProviderTrace } from "./providers/types";

// Re-export for backward compatibility
export { ProviderTranslationError as GeminiTranslationError };
export type { ProviderTrace as GeminiTrace, UsageInfo as GeminiUsage } from "./providerLog";

type GenerateOptions = {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  videoUri?: string;
  temperature?: number;
  safetyOff?: boolean;
  trace?: ProviderTrace;
  mediaResolution?: "low" | "standard";
};

export type GenerateContentResult = {
  text: string;
  usage?: import("./providerLog").UsageInfo;
};

/**
 * @deprecated Use provider.generateContent() instead
 */
export async function translateChunkText(
  opts: GenerateOptions,
): Promise<GenerateContentResult> {
  const config: ProviderConfig = {
    apiKey: opts.apiKey,
    modelName: opts.modelName,
  };

  const provider = new GeminiProvider(config);

  const request: GenerateRequest = {
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    mediaUri: opts.videoUri,
    safetyOff: opts.safetyOff,
  };

  return provider.generateContent(request, opts.trace);
}

/**
 * @deprecated Use provider.listModels() instead
 */
export async function listModels(apiKey: string): Promise<string[]> {
  const config: ProviderConfig = { apiKey, modelName: "gemini-2.5-pro" };
  const provider = new GeminiProvider(config);
  const models = await provider.listModels();
  return models.map((m) => m.id);
}

/**
 * @deprecated Use provider.uploadMedia() instead
 */
export async function uploadContextVideo(
  file: File,
  apiKey: string,
): Promise<{ fileUri: string; fileName?: string }> {
  const config: ProviderConfig = { apiKey, modelName: "gemini-2.5-pro" };
  const provider = new GeminiProvider(config);
  if (!provider.uploadMedia) {
    throw new ProviderTranslationError("Provider does not support media upload");
  }
  return provider.uploadMedia(file);
}

/**
 * @deprecated Use provider.deleteMedia() instead
 */
export async function deleteUploadedFile(
  fileNameOrUri: string,
  apiKey: string,
): Promise<void> {
  const config: ProviderConfig = { apiKey, modelName: "gemini-2.5-pro" };
  const provider = new GeminiProvider(config);
  if (!provider.deleteMedia) {
    throw new ProviderTranslationError("Provider does not support media deletion");
  }
  return provider.deleteMedia(fileNameOrUri);
}

// For now, keep the same functions but they just redirect to provider implementations
// This maintains backward compatibility with existing code
