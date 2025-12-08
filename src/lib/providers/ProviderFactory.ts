import type { ProviderConfig, ProviderType, TranslationProvider } from "./types";
import { GeminiProvider } from "./GeminiProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { AnthropicProvider } from "./AnthropicProvider";
import { OllamaProvider } from "./OllamaProvider";

// ============================================================================
// MOCK MODE INTEGRATION (can be removed by deleting this block + src/lib/mock/)
// ============================================================================
import { MockProvider, isMockMode } from "../mock/MockProvider";
// ============================================================================

/**
 * Provider registry and factory
 */
export class ProviderFactory {
    private static providers: Map<ProviderType, typeof GeminiProvider> = new Map([
        ["gemini", GeminiProvider],
        ["openai", OpenAIProvider],
        ["anthropic", AnthropicProvider],
        ["ollama", OllamaProvider],
    ]);

    /**
     * Create a provider instance
     *
     * When mock mode is enabled (VITE_MOCK=1 or ?mock=1), returns MockProvider
     * regardless of requested type. This allows testing UX flows without API calls.
     */
    static create(
        type: ProviderType,
        config: ProviderConfig,
    ): TranslationProvider {
        // ============================================================================
        // MOCK MODE: Return MockProvider when enabled (DELETE THIS BLOCK TO REMOVE MOCK)
        // ============================================================================
        if (isMockMode()) {
            console.log(`[ProviderFactory] Mock mode enabled, using MockProvider`);
            return new MockProvider(config);
        }
        // ============================================================================

        const ProviderClass = this.providers.get(type);
        if (!ProviderClass) {
            throw new Error(`Unknown provider type: ${type}`);
        }
        return new ProviderClass(config);
    }

    /**
     * Get all available provider types
     */
    static getAvailableProviders(): ProviderType[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a provider type is supported
     */
    static isSupported(type: string): type is ProviderType {
        return this.providers.has(type as ProviderType);
    }
}

/**
 * Parse a namespaced model name (provider/model) into components
 */
export function parseModelName(fullName: string): {
    provider: ProviderType;
    model: string;
} {
    const parts = fullName.split("/");
    if (parts.length === 2 && ProviderFactory.isSupported(parts[0])) {
        return { provider: parts[0] as ProviderType, model: parts[1] };
    }
    // Default to gemini for backward compatibility
    return { provider: "gemini", model: fullName };
}

/**
 * Format a model name with provider namespace
 */
export function formatModelName(provider: ProviderType, model: string): string {
    return `${provider}/${model}`;
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(
    provider: ProviderType,
    config: ProviderConfig,
): boolean {
    try {
        const instance = ProviderFactory.create(provider, config);
        return instance.validateConfig(config);
    } catch {
        return false;
    }
}
