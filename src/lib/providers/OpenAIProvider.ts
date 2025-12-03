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

const API_ROOT = "https://api.openai.com/v1";

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseProvider {
    readonly type = "openai" as const;
    readonly capabilities: ProviderCapabilities = {
        supportsMediaUpload: false,
        supportsVision: true, // GPT-4 Vision supports images
        supportsTemperature: true,
        supportsSafetySettings: false,
        requiresApiKey: true,
        supportsStreaming: false,
        canTranscribeAudio: true, // Whisper API support
    };

    getProviderInfo() {
        return {
            name: "OpenAI",
            description: "OpenAI's GPT models including GPT-4 and GPT-3.5",
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
            promptTokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined,
            responseTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : undefined,
            totalTokens: typeof u.total_tokens === "number" ? u.total_tokens : undefined,
        };
    }

    async generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse> {
        const { systemPrompt, userPrompt, temperature } = request;
        const url = `${API_ROOT}/chat/completions`;
        const startedAt = Date.now();

        const messages: Array<{ role: string; content: string }> = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];

        const body: Record<string, unknown> = {
            model: this.config.modelName,
            messages,
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
                        Authorization: `Bearer ${this.config.apiKey}`,
                    },
                    body: JSON.stringify(body),
                });

                const text =
                    (data as {
                        choices?: Array<{ message?: { content?: string } }>;
                    }).choices?.[0]?.message?.content?.trim() || "";

                if (!text) {
                    throw new ProviderTranslationError("Empty response from OpenAI");
                }

                const usage = this.extractUsage(data);
                addProviderLog({
                    provider: "openai",
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
                    provider: "openai",
                    purpose: trace?.purpose || "generateContent",
                    status: "error",
                    model: this.config.modelName,
                    temperature,
                    durationMs: Date.now() - startedAt,
                    chunkIdx: trace?.chunkIdx,
                    runId: trace?.runId,
                    message: err instanceof Error ? err.message : "OpenAI generateContent failed",
                });
                throw err;
            }
        };

        return withRetry(callApi);
    }

    async listModels(): Promise<ModelInfo[]> {
        const url = `${API_ROOT}/models`;
        const startedAt = Date.now();

        try {
            const data = await this.requestJson(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
            });

            const models = Array.isArray((data as { data?: unknown }).data)
                ? (data as { data: unknown[] }).data
                : [];

            addProviderLog({
                provider: "openai",
                purpose: "listModels",
                status: "ok",
                durationMs: Date.now() - startedAt,
            });

            // Filter to chat models only
            return models
                .filter((m) => {
                    const id = (m as { id?: string }).id || "";
                    return (
                        id.includes("gpt-4") ||
                        id.includes("gpt-3.5") ||
                        id === "gpt-4-turbo" ||
                        id === "gpt-4o"
                    );
                })
                .map((m) => ({
                    id: (m as { id: string }).id,
                    displayName: (m as { id: string }).id,
                    provider: "openai" as const,
                }));
        } catch (err) {
            addProviderLog({
                provider: "openai",
                purpose: "listModels",
                status: "error",
                durationMs: Date.now() - startedAt,
                message: err instanceof Error ? err.message : "Failed to list models",
            });
            throw err;
        }
    }

    /**
     * Transcribe audio to VTT format using Whisper API
     */
    async transcribeAudio(file: File, language?: string): Promise<string> {
        const url = `${API_ROOT}/audio/transcriptions`;
        const startedAt = Date.now();

        try {
            // Create form data
            const formData = new FormData();
            formData.append("file", file);
            formData.append("model", "whisper-1");
            formData.append("response_format", "vtt");

            // Add language if provided
            if (language) {
                formData.append("language", language);
            }

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new ProviderTranslationError(
                    `Whisper API error (${response.status}): ${errorText}`
                );
            }

            const vttContent = await response.text();

            if (!vttContent || !vttContent.startsWith("WEBVTT")) {
                throw new ProviderTranslationError(
                    "Invalid VTT response from Whisper API"
                );
            }

            addProviderLog({
                provider: "openai",
                purpose: "transcribeAudio",
                status: "ok",
                model: "whisper-1",
                durationMs: Date.now() - startedAt,
            });

            return vttContent;
        } catch (err) {
            addProviderLog({
                provider: "openai",
                purpose: "transcribeAudio",
                status: "error",
                model: "whisper-1",
                durationMs: Date.now() - startedAt,
                message: err instanceof Error ? err.message : "Transcription failed",
            });
            throw err;
        }
    }
}
