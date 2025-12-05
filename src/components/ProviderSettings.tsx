import React, { useEffect } from "react";
import type { ProviderType } from "../lib/providers/types";
import { useTheme } from "../lib/themeContext";
import { getProviderCapability } from "../lib/providers/capabilities";
import { Button } from "./ui/Button";
import { SectionCard } from "./ui/SectionCard";
import { FieldLabel, TextInput } from "./ui/Field";
import { ProviderSpecificSettings } from "./providers/ProviderSpecificSettings";

type Props = {
    // Provider selection
    selectedProvider: ProviderType;
    setSelectedProvider: (provider: ProviderType) => void;
    workflowMode?: "translation" | "transcription";

    // API keys per provider
    apiKeys: Record<ProviderType, string>;
    setApiKey: (provider: ProviderType, key: string) => void;

    // Ollama-specific
    ollamaBaseUrl: string;
    setOllamaBaseUrl: (url: string) => void;

    // Provider-specific configs
    providerConfigs: {
        openai: {
            transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
            transcriptionLanguage?: string;
            transcriptionConcurrency?: number;
            transcriptionChunkSeconds?: number;
        };
    };
    onProviderConfigChange: (provider: "openai", config: {
        transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
        transcriptionLanguage?: string;
        transcriptionConcurrency?: number;
        transcriptionChunkSeconds?: number;
    }) => void;

    // Model selection
    modelName: string;
    setModelName: (name: string) => void;
    models: string[];
    handleLoadModels: () => void;
    submitting: boolean;
    error: string;

    // Settings (provider-specific)
    temperature: number;
    setTemperature: (t: number) => void;
    safetyOff: boolean;
    setSafetyOff: (v: boolean) => void;
    mediaResolution: "low" | "standard";
    setMediaResolution: (v: "low" | "standard") => void;
    useInlineChunks: boolean;
    setUseInlineChunks: (use: boolean) => void;

    locked?: boolean;
};

export function ProviderSettings({
    selectedProvider,
    setSelectedProvider,
    apiKeys,
    setApiKey,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    providerConfigs,
    onProviderConfigChange,
    modelName,
    setModelName,
    models,
    handleLoadModels,
    submitting,
    error,
    temperature,
    setTemperature,
    safetyOff,
    setSafetyOff,
    mediaResolution,
    setMediaResolution,
    useInlineChunks,
    setUseInlineChunks,
    workflowMode = "translation",
    locked = false,
}: Props) {
    const theme = useTheme();

    const currentApiKey = apiKeys[selectedProvider] || "";
    const capability = getProviderCapability(selectedProvider);
    const requiresApiKey = capability.requiresApiKey;
    const supportsMediaUpload = capability.supportsMediaUpload;
    const supportsSafetySettings = capability.supportsSafetySettings;
    const transcriptionMode = workflowMode === "transcription";

    const providerLabels: Record<ProviderType, string> = {
        gemini: getProviderCapability("gemini").label,
        openai: getProviderCapability("openai").label,
        anthropic: getProviderCapability("anthropic").label,
        ollama: getProviderCapability("ollama").label,
    };

    const transcriptionCapable: Record<ProviderType, boolean> = {
        gemini: true,
        openai: true,
        anthropic: false,
        ollama: false,
    };

    const providerDescriptions: Record<ProviderType, string> = transcriptionMode
        ? {
              gemini: "Video/audio transcription with File API or inline chunking",
              openai: "Whisper (VTT) or GPT-4o (text) transcription",
              anthropic: "Not available for transcription",
              ollama: "Not available for transcription",
          }
        : {
              gemini: "Best for video context and media-rich content",
              openai: "GPT-4 and GPT-3.5 models for high-quality translation",
              anthropic: "Claude models for nuanced and creative translation",
              ollama: "Local models for privacy and offline use",
          };

    const filteredModels =
        transcriptionMode && selectedProvider === "openai"
            ? models.filter((name) => {
                  const lower = name.toLowerCase();
                  return lower.includes("whisper") || lower.includes("transcribe");
              })
            : models;
    const modelsToDisplay = filteredModels.length ? filteredModels : models;
    const filteredFallback =
        transcriptionMode && selectedProvider === "openai" && !filteredModels.length;

    useEffect(() => {
        if (
            transcriptionMode &&
            selectedProvider === "openai" &&
            modelsToDisplay.length > 0 &&
            !modelsToDisplay.includes(modelName)
        ) {
            const nextModel = modelsToDisplay[0];
            setModelName(nextModel);
            const modelId = nextModel.includes("/") ? nextModel.split("/").pop() || nextModel : nextModel;
            const lowered = modelId.toLowerCase();
            if (lowered.includes("whisper") || lowered.includes("transcribe")) {
                onProviderConfigChange("openai", {
                    ...providerConfigs.openai,
                    transcriptionModel: modelId as
                        | "whisper-1"
                        | "gpt-4o-transcribe"
                        | "gpt-4o-mini-transcribe",
                });
            }
        }
        // Only react to model list / mode changes; intentional to skip providerConfigs in deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcriptionMode, selectedProvider, modelsToDisplay]);

    return (
        <SectionCard
            title="API Provider Settings"
            subtitle="Choose your AI provider and configure settings."
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider Selection */}
                <div className="space-y-2 md:col-span-2">
                    <FieldLabel>AI Provider</FieldLabel>
                    <select
                        className={theme.input}
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value as ProviderType)}
                        disabled={locked}
                    >
                        {(Object.keys(providerLabels) as ProviderType[]).map((provider) => (
                            <option
                                key={provider}
                                value={provider}
                                disabled={transcriptionMode && !transcriptionCapable[provider]}
                            >
                                {providerLabels[provider]}
                                {transcriptionMode && !transcriptionCapable[provider] ? " (not available for transcription)" : ""}
                            </option>
                        ))}
                    </select>
                    <p className={theme.helperText}>
                        {providerDescriptions[selectedProvider]}
                    </p>
                </div>

                {/* API Key Input */}
                {requiresApiKey && (
                    <div className="space-y-2 md:col-span-2">
                        <FieldLabel>API Key</FieldLabel>
                        <TextInput
                            type="password"
                            value={currentApiKey}
                            onChange={(e) => setApiKey(selectedProvider, e.target.value)}
                            placeholder={`Enter your ${providerLabels[selectedProvider]} API Key`}
                            disabled={locked}
                        />
                        <p className={theme.helperText}>
                            Your key is stored locally in your browser.
                        </p>
                    </div>
                )}

                {/* Ollama Base URL */}
                {selectedProvider === "ollama" && (
                    <div className="space-y-2 md:col-span-2">
                        <FieldLabel>Ollama Base URL</FieldLabel>
                        <div className="flex gap-2">
                            <TextInput
                                type="text"
                                value={ollamaBaseUrl}
                                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                placeholder="http://localhost:11434"
                                disabled={locked}
                            />
                        </div>
                        <p className={theme.helperText}>
                            Default is http://localhost:11434. Ensure Ollama is running with
                            CORS allowed.
                        </p>
                    </div>
                )}

                {/* Model Selection */}
                <div className="space-y-2 md:col-span-2">
                    <FieldLabel>Model Selection</FieldLabel>
                    <div className="flex gap-2">
                        <select
                            className={theme.input}
                            value={modelName}
                            onChange={(e) => {
                                const value = e.target.value;
                                setModelName(value);
                                if (transcriptionMode && selectedProvider === "openai") {
                                    const modelId = value.includes("/") ? value.split("/").pop() || value : value;
                                    const lowered = modelId.toLowerCase();
                                    if (lowered.includes("whisper") || lowered.includes("transcribe")) {
                                        onProviderConfigChange("openai", {
                                            ...providerConfigs.openai,
                                            transcriptionModel: modelId as
                                                | "whisper-1"
                                                | "gpt-4o-transcribe"
                                                | "gpt-4o-mini-transcribe",
                                        });
                                    }
                                }
                            }}
                            disabled={locked || modelsToDisplay.length === 0}
                        >
                            {modelsToDisplay.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="button"
                            tone="secondary"
                            onClick={handleLoadModels}
                            disabled={submitting || locked || (requiresApiKey && !currentApiKey)}
                        >
                            Load Models
                        </Button>
                    </div>
                    {transcriptionMode && selectedProvider === "openai" && (
                        <p className={theme.helperText}>
                            Showing models that include "whisper" or "transcribe"
                            {filteredFallback ? " (none found, showing all models)" : ""}
                        </p>
                    )}
                </div>

                {/* Gemini transcription chunking mode (inline vs File API) */}
                {transcriptionMode && selectedProvider === "gemini" && (
                    <div className="space-y-2 md:col-span-2">
                        <FieldLabel>Gemini Media Mode</FieldLabel>
                        <select
                            className={theme.input}
                            value={useInlineChunks ? "inline" : "fileapi"}
                            onChange={(e) => setUseInlineChunks(e.target.value === "inline")}
                            disabled={locked}
                        >
                            <option value="fileapi">File API (upload then reference with time offsets)</option>
                            <option value="inline">Inline audio chunks (no upload; extract locally)</option>
                        </select>
                        <p className={theme.helperText}>
                            File API uploads media then uses offsets per chunk. Inline extracts audio chunks locally and skips provider upload (token-accurate, slower client-side).
                        </p>
                    </div>
                )}

                {/* Temperature */}
                <div className="space-y-2">
                    <FieldLabel>Temperature: {temperature}</FieldLabel>
                    <input
                        type="range"
                        min="0"
                        max="1" // Most providers use 0-1 or 0-2, sticking to 0-1 for safety
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full"
                        disabled={locked}
                    />
                    <p className={theme.helperText}>
                        Lower values are more deterministic, higher values are more creative.
                    </p>
                </div>

                {/* Gemini Safety Settings */}
                {supportsSafetySettings && (
                    <div className="space-y-2">
                        <FieldLabel>Safety Settings</FieldLabel>
                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={safetyOff}
                                onChange={(e) => setSafetyOff(e.target.checked)}
                                disabled={locked}
                            />
                            <span>Disable Safety Filters</span>
                        </label>
                        <p className={theme.helperText}>
                            May help if the model refuses to translate certain content. Use with
                            caution.
                        </p>
                    </div>
                )}

                {/* Gemini Media Resolution */}
                {supportsMediaUpload && (
                    <div className="space-y-2">
                        <FieldLabel>Media Resolution</FieldLabel>
                        <select
                            className={theme.input}
                            value={mediaResolution}
                            onChange={(e) =>
                                setMediaResolution(e.target.value as "low" | "standard")
                            }
                            disabled={locked}
                        >
                            <option value="low">Low (Token Efficient)</option>
                            <option value="standard">Standard (Higher Quality)</option>
                        </select>
                        <p className={theme.helperText}>
                            Low cuts token usage for video summaries. Switch to standard if
                            visual detail is missing.
                        </p>
                    </div>
                )}

                {/* Provider-specific settings */}
                <div className="md:col-span-2">
                    <ProviderSpecificSettings
                        provider={selectedProvider}
                        config={providerConfigs}
                        onChange={(newConfig) => {
                            // Currently only OpenAI supported
                            if (selectedProvider === "openai" && newConfig.openai) {
                                onProviderConfigChange("openai", newConfig.openai);
                            }
                        }}
                        locked={locked}
                    />
                </div>
            </div>

            {error && error.toLowerCase().includes("api key") && (
                <p className={`text-sm ${theme.dangerText} mt-2`}>{error}</p>
            )}
        </SectionCard>
    );
}
