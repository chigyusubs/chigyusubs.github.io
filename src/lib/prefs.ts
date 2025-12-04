import type { ProviderType } from "./providers/types";
import type { WorkflowMode } from "../config/defaults";

export type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string; // For Ollama
};

export type UserPrefs = {
  // Provider selection
  selectedProvider?: ProviderType;
  providerConfigs?: Record<ProviderType, ProviderConfig>;

  // Provider-specific configurations (e.g., OpenAI transcription settings)
  providerSpecificConfigs?: {
    openai?: {
      transcriptionEnabled?: boolean;
      transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
      transcriptionLanguage?: string;
      transcriptionConcurrency?: number;
      transcriptionChunkSeconds?: number;
    };
  };

  // Legacy fields (for backward compatibility)
  modelName?: string;
  models?: string[];
  workflowMode?: WorkflowMode;

  // Current settings
  mediaResolution?: "low" | "standard";
  useAudioOnly?: boolean;
  targetLang?: string;
  chunkSeconds?: number;
  chunkOverlap?: number;
  concurrency?: number;
  temperature?: number;
  customPrompt?: string;
  glossary?: string;
  summaryText?: string;
  summaryPrompt?: string;
  glossaryPrompt?: string;
  useSummary?: boolean;
  useGlossary?: boolean;
  useGlossaryInSummary?: boolean;
  useTranscriptionForSummary?: boolean;
  safetyOff?: boolean;
};

const PREFS_KEY = "chigyusubs_prefs";

export function loadPrefs(): UserPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const prefs = JSON.parse(raw) as UserPrefs;

    // Migration: If old format (no selectedProvider), migrate to new format
    if (!prefs.selectedProvider) {
      prefs.selectedProvider = "gemini"; // Default to Gemini for existing users
      prefs.providerConfigs = prefs.providerConfigs || {
        gemini: {},
        openai: {},
        anthropic: {},
        ollama: { baseUrl: "http://localhost:11434" },
      };
    }

    return prefs;
  } catch {
    return null;
  }
}

export function savePrefs(prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function clearPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFS_KEY);
  } catch {
    // ignore storage errors
  }
}
