import { BaseProvider, ProviderTranslationError, withRetry } from "./BaseProvider";
import type {
    GenerateRequest,
    GenerateResponse,
    ModelInfo,
    ProviderCapabilities,
    ProviderConfig,
    ProviderTrace,
    UsageInfo,
} from "./types";
import { addProviderLog } from "../providerLog";

const API_ROOT = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider extends BaseProvider {
    readonly type = "anthropic" as const;
    readonly capabilities: ProviderCapabilities = {
        supportsMediaUpload: false,
        supportsVision: true, // Claude 3 supports images via base64
        supportsTemperature: true,
        supportsSafetySettings: false,
        requiresApiKey: true,
        supportsStreaming: false,
    };

    getProviderInfo() {
        return {
            name: "Anthropic Claude",
            description: "Anthropic's Claude models including Claude 3 series",
            capabilities: this.capabilities,
        };
    }

    validateConfig(config: ProviderConfig): boolean {
        if (!super.validateConfig(config)) return false;
        if (!config.apiKey) return false;
        return true;
    }

    private extractUsage(data: unknown): UsageInfo | undefined {
        const usage = (data as { usage?: unknown })?.usage;
        if (!usage || typeof usage !== "object") return undefined;
        const u = usage as Record<string, unknown>;
        return {
            promptTokens: typeof u.input_tokens === "number" ? u.input_tokens : undefined,
            responseTokens: typeof u.output_tokens === "number" ? u.output_tokens : undefined,
            totalTokens:
                typeof u.input_tokens === "number" && typeof u.output_tokens === "number"
                    ? u.input_tokens + u.output_tokens
                    : undefined,
        };
    }

    async generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse> {
        const { systemPrompt, userPrompt, temperature } = request;
        const url = `${API_ROOT}/messages`;
        const startedAt = Date.now();

        const body: Record<string, unknown> = {
            model: this.config.modelName,
            max_tokens: 4096, // Anthropic requires this
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
        };

        if (typeof temperature === "number") {
            body.temperature = temperature;
        }

        const callApi = async (): Promise<GenerateResponse> => {
            try {
                const data = await this.requestJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": this.config.apiKey!,
                        "anthropic-version": ANTHROPIC_VERSION,
                    },
                    body: JSON.stringify(body),
                });

                const text =
                    (data as {
                        content?: Array<{ type?: string; text?: string }>;
                    }).content
                        ?.filter((c) => c.type === "text")
                        .map((c) => c.text || "")
                        .join("")
                        .trim() || "";

                if (!text) {
                    throw new ProviderTranslationError("Empty response from Anthropic");
                }

                const usage = this.extractUsage(data);
                addProviderLog({
                    provider: "anthropic",
                    purpose: trace?.purpose || "generateContent",
                    status: "ok",
                    model: this.config.modelName,
                    temperature,
                    durationMs: Date.now() - startedAt,
                    chunkIdx: trace?.chunkIdx,
                    runId: trace?.runId,
                    tokens: usage,
                });

                return { text, usage };
            } catch (err) {
                addProviderLog({
                    provider: "anthropic",
                    purpose: trace?.purpose || "generateContent",
                    status: "error",
                    model: this.config.modelName,
                    temperature,
                    durationMs: Date.now() - startedAt,
                    chunkIdx: trace?.chunkIdx,
                    runId: trace?.runId,
                    message: err instanceof Error ? err.message : "Anthropic generateContent failed",
                });
                throw err;
            }
        };

        return withRetry(callApi);
    }

    async listModels(): Promise<ModelInfo[]> {
        // Anthropic doesn't provide a models endpoint, so we return a static list
        const startedAt = Date.now();

        addProviderLog({
            provider: "anthropic",
            purpose: "listModels",
            status: "ok",
            durationMs: Date.now() - startedAt,
        });

        return [
            {
                id: "claude-3-5-sonnet-20241022",
                displayName: "Claude 3.5 Sonnet (Latest)",
                provider: "anthropic" as const,
                description: "Most capable Claude 3.5 model",
            },
            {
                id: "claude-3-5-haiku-20241022",
                displayName: "Claude 3.5 Haiku (Latest)",
                provider: "anthropic" as const,
                description: "Fastest Claude 3.5 model",
            },
            {
                id: "claude-3-opus-20240229",
                displayName: "Claude 3 Opus",
                provider: "anthropic" as const,
                description: "Most capable Claude 3 model",
            },
            {
                id: "claude-3-sonnet-20240229",
                displayName: "Claude 3 Sonnet",
                provider: "anthropic" as const,
                description: "Balanced Claude 3 model",
            },
            {
                id: "claude-3-haiku-20240307",
                displayName: "Claude 3 Haiku",
                provider: "anthropic" as const,
                description: "Fastest Claude 3 model",
            },
        ];
    }
}
