import type { ProviderType } from "./types";

export type ProviderCapability = {
  label: string;
  supportsMediaUpload: boolean;
  supportsSafetySettings: boolean;
  requiresApiKey: boolean;
};

const capabilityMap: Record<ProviderType, ProviderCapability> = {
  gemini: {
    label: "Google Gemini",
    supportsMediaUpload: true,
    supportsSafetySettings: true,
    requiresApiKey: true,
  },
  openai: {
    label: "OpenAI",
    supportsMediaUpload: false,
    supportsSafetySettings: false,
    requiresApiKey: true,
  },
  anthropic: {
    label: "Anthropic Claude",
    supportsMediaUpload: false,
    supportsSafetySettings: false,
    requiresApiKey: true,
  },
  ollama: {
    label: "Ollama (Local)",
    supportsMediaUpload: false,
    supportsSafetySettings: false,
    requiresApiKey: false,
  },
};

export function getProviderCapability(provider: ProviderType): ProviderCapability {
  return capabilityMap[provider];
}
