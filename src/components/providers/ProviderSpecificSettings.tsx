import React from "react";
import type { ProviderType } from "../../lib/providers/types";
import { OpenAIAdvancedSettings } from "./OpenAIAdvancedSettings";

type ProviderSpecificConfig = {
    openai?: {
        transcriptionEnabled: boolean;
        transcriptionModel?: "whisper-1";
        transcriptionLanguage?: string;
    };
    // Add other providers as needed
};

type Props = {
    provider: ProviderType;
    config: ProviderSpecificConfig;
    onChange: (config: ProviderSpecificConfig) => void;
    locked?: boolean;
};

/**
 * Router component that delegates to provider-specific settings components
 */
export function ProviderSpecificSettings({
    provider,
    config,
    onChange,
    locked = false,
}: Props) {
    switch (provider) {
        case "openai":
            return (
                <OpenAIAdvancedSettings
                    config={config.openai || {
                        transcriptionEnabled: false,
                        transcriptionModel: "whisper-1",
                        transcriptionLanguage: "",
                    }}
                    onChange={(openaiConfig) => onChange({ ...config, openai: openaiConfig })}
                    locked={locked}
                />
            );
        case "gemini":
        case "anthropic":
        case "ollama":
            // No provider-specific settings yet (will move existing settings here later)
            return null;
        default:
            return null;
    }
}
