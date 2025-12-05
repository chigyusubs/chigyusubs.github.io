import type { ProviderType } from "../../lib/providers/types";

type ProviderSpecificConfig = {
    openai?: {
        transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
        transcriptionLanguage?: string;
        transcriptionConcurrency?: number;
        transcriptionChunkSeconds?: number;
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
}: Props) {
    switch (provider) {
        case "openai":
            return null; // OpenAI transcription settings live in the Transcription settings section
        case "gemini":
        case "anthropic":
        case "ollama":
            // No provider-specific settings yet (will move existing settings here later)
            return null;
        default:
            return null;
    }
}
