import type { ProviderType } from "./providers/types";
import type { StructuredCueHintMode } from "./structured/StructuredPrompt";
import type { WorkflowMode } from "../config/defaults";

export type ProviderConfig = {
  baseUrl?: string; // For Ollama
};

export type UserPrefs = {
  // Provider selection
  selectedProvider?: ProviderType;
  providerConfigs?: Record<ProviderType, ProviderConfig>;

  // Provider-specific configurations (e.g., OpenAI transcription settings)
  providerSpecificConfigs?: {
    openai?: {
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
  transcriptionPrompt?: string;
  transcriptionOverlapSeconds?: number;
  thinkingBudget?: number;
  maxOutputTokens?: number;
  topP?: number;
  summaryText?: string;
  summaryPrompt?: string;
  glossaryPrompt?: string;
  useSummary?: boolean;
  useGlossary?: boolean;
  useGlossaryInSummary?: boolean;
  useTranscriptionForSummary?: boolean;
  thinkingLevel?: "low" | "high";
  safetyOff?: boolean;
  useStructuredOutput?: boolean;
  structuredCueHintMode?: StructuredCueHintMode;
};

const PREFS_KEY = "chigyusubs_prefs";

export function loadPrefs(): UserPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const prefs = JSON.parse(raw) as UserPrefs;

    // Migration: If old format (no selectedProvider), migrate to new format
    // Strip any persisted API keys (we do not store keys)
    if (prefs.providerConfigs) {
      Object.keys(prefs.providerConfigs).forEach((key) => {
        const cfg = prefs.providerConfigs?.[key as ProviderType];
        if (cfg && "apiKey" in cfg) {
          delete (cfg as Record<string, unknown>).apiKey;
        }
      });
    }

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
