import { useState } from "react";
import {
  DEFAULT_MODEL,
  DEFAULT_MODELS,
  TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
  TRANSCRIPTION_DEFAULT_CONCURRENCY,
} from "../config/defaults";
import type { ProviderType } from "../lib/providers/types";
import type { UserPrefs } from "../lib/prefs";

type OpenAIConfig = {
  transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
  transcriptionLanguage?: string;
  transcriptionConcurrency?: number;
  transcriptionChunkSeconds?: number;
};

type ProviderConfigs = {
  openai: OpenAIConfig;
};

export function useProviderState(saved?: UserPrefs) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(
    saved?.selectedProvider ?? "gemini",
  );

  const [apiKeys, setApiKeys] = useState<Record<ProviderType, string>>({
    gemini: "",
    openai: "",
    anthropic: "",
    ollama: "",
  });

  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    saved?.providerConfigs?.ollama?.baseUrl ?? "http://localhost:11434",
  );

  const [models, setModels] = useState<string[]>(
    saved?.models && saved.models.length ? saved.models : DEFAULT_MODELS,
  );
  const [modelName, setModelName] = useState(saved?.modelName ?? DEFAULT_MODEL);

  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigs>(() => {
    const defaultConfig: ProviderConfigs = {
      openai: {
        transcriptionModel: "gpt-4o-mini-transcribe",
        transcriptionLanguage: "",
        transcriptionConcurrency: TRANSCRIPTION_DEFAULT_CONCURRENCY,
        transcriptionChunkSeconds: TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
      },
    };
    if (saved?.providerSpecificConfigs?.openai) {
      return {
        openai: { ...defaultConfig.openai, ...saved.providerSpecificConfigs.openai },
      };
    }
    return defaultConfig;
  });

  const apiKey = apiKeys[selectedProvider];
  const setApiKey = (provider: ProviderType, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  };

  const updateProviderConfig = (provider: "openai", config: OpenAIConfig) => {
    setProviderConfigs((prev) => ({
      ...prev,
      [provider]: config,
    }));
  };

  return {
    selectedProvider,
    setSelectedProvider,
    apiKeys,
    setApiKey,
    apiKey,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    models,
    setModels,
    modelName,
    setModelName,
    providerConfigs,
    updateProviderConfig,
  };
}
