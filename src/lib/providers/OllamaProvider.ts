import { BaseProvider, ProviderTranslationError, withRetry } from "./BaseProvider";
import type {
    GenerateRequest,
    GenerateResponse,
    ModelInfo,
    ProviderCapabilities,
    ProviderConfig,
    ProviderTrace,
} from "./types";
import { addProviderLog } from "../providerLog";

/**
 * Ollama provider implementation for local models
 */
export class OllamaProvider extends BaseProvider {
    readonly type = "ollama" as const;
    readonly capabilities: ProviderCapabilities = {
        supportsMediaUpload: false,
        supportsVision: true, // Some Ollama models support vision
        supportsTemperature: true,
        supportsSafetySettings: false,
        requiresApiKey: false,
        supportsStreaming: false,
    };

    constructor(config: ProviderConfig) {
        super(config);
        // Default base URL if not provided
        if (!this.config.baseUrl) {
            this.config.baseUrl = "http://localhost:11434";
        }
    }

    getProviderInfo() {
        return {
            name: "Ollama",
            description: "Locally hosted open-source models via Ollama",
            capabilities: this.capabilities,
        };
    }

    validateConfig(config: ProviderConfig): boolean {
        // Ollama doesn't require API key
        if (!config.modelName) return false;
        if (!config.baseUrl) return false;
        return true;
    }

    async generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse> {
        const { systemPrompt, userPrompt, temperature } = request;
        const url = `${this.config.baseUrl}/api/chat`;
        const startedAt = Date.now();

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];

        console.log("[Ollama] Sending request:", { url, model: this.config.modelName, messages });

        const body: Record<string, unknown> = {
            model: this.config.modelName,
            messages,
            stream: false,
            format: request.responseMimeType === "application/json" ? "json" : undefined,
        };

        if (typeof temperature === "number") {
            body.options = { temperature };
        }

        const callApi = async (): Promise<GenerateResponse> => {
            try {
                const data = await this.requestJson(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                });

                const text = ((data as { message?: { content?: string } })?.message?.content || "").trim();

                if (!text) {
                    throw new ProviderTranslationError("Empty response from Ollama");
                }

                addProviderLog({
                    provider: "ollama",
                    purpose: trace?.purpose || "generateContent",
                    status: "ok",
                    model: this.config.modelName,
                    temperature,
                    durationMs: Date.now() - startedAt,
                    chunkIdx: trace?.chunkIdx,
                    runId: trace?.runId,
                });

                return { text };
            } catch (err) {
                addProviderLog({
                    provider: "ollama",
                    purpose: trace?.purpose || "generateContent",
                    status: "error",
                    model: this.config.modelName,
                    temperature,
                    durationMs: Date.now() - startedAt,
                    chunkIdx: trace?.chunkIdx,
                    runId: trace?.runId,
                    message: err instanceof Error ? err.message : "Ollama generateContent failed",
                });
                throw err;
            }
        };

        return withRetry(callApi);
    }

    async listModels(): Promise<ModelInfo[]> {
        const url = `${this.config.baseUrl}/api/tags`;
        const startedAt = Date.now();

        try {
            const data = await this.requestJson(url, { method: "GET" });

            const models = Array.isArray((data as { models?: unknown }).models)
                ? (data as { models: unknown[] }).models
                : [];

            addProviderLog({
                provider: "ollama",
                purpose: "listModels",
                status: "ok",
                durationMs: Date.now() - startedAt,
            });

            return models.map((m) => ({
                id: (m as { name: string }).name,
                displayName: (m as { name: string }).name,
                provider: "ollama" as const,
                description: `Size: ${(m as { size?: number }).size ? ((m as { size: number }).size / 1e9).toFixed(1) + "GB" : "unknown"}`,
            }));
        } catch (err) {
            let message = err instanceof Error ? err.message : "Failed to list models";

            // Check for likely CORS error (browser "Failed to fetch" usually means network error or CORS)
            if (err instanceof TypeError && message === "Failed to fetch") {
                message = `Connection failed. If Ollama is running, this is likely a CORS issue. Please run Ollama with: OLLAMA_ORIGINS="*" ollama serve`;
            }

            addProviderLog({
                provider: "ollama",
                purpose: "listModels",
                status: "error",
                durationMs: Date.now() - startedAt,
                message,
            });

            // Throw the enhanced message
            throw new Error(message);
        }
    }
}
