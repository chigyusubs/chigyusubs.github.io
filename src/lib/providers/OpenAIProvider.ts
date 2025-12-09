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

    /**
     * Convert OpenAI JSON transcription response to VTT format
     */
    private convertJsonToVtt(jsonData: unknown): string {
        const data = jsonData as { text?: string; segments?: Array<{ start: number; end: number; text: string }> };

        if (!data || typeof data !== "object") {
            throw new ProviderTranslationError("Invalid JSON response from transcription API");
        }

        // Start VTT file
        let vtt = "WEBVTT\n\n";

        // If we have segments with timestamps, use them
        if (Array.isArray(data.segments) && data.segments.length > 0) {
            data.segments.forEach((segment, index) => {
                const start = this.formatVttTimestamp(segment.start);
                const end = this.formatVttTimestamp(segment.end);
                vtt += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
            });
        } else if (data.text) {
            // Fallback: single cue with full text
            vtt += `1\n00:00:00.000 --> 00:00:10.000\n${data.text.trim()}\n\n`;
        } else {
            throw new ProviderTranslationError("No transcription text found in JSON response");
        }

        return vtt;
    }

    /**
     * Format seconds to VTT timestamp (HH:MM:SS.mmm)
     */
    private formatVttTimestamp(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    async generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse> {
        const {
            systemPrompt,
            userPrompt,
            temperature,
            responseMimeType,
            responseJsonSchema,
        } = request;
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

        // Enable JSON mode when requested
        if (responseMimeType === "application/json" || responseJsonSchema) {
            if (responseJsonSchema) {
                body.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "structured_output",
                        schema: responseJsonSchema,
                    },
                };
            } else {
                body.response_format = { type: "json_object" };
            }
        }

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
                    // Allow current and future GPT chat models (e.g., gpt-3.5, gpt-4, gpt-4o, gpt-5.x)
                    return id.startsWith("gpt-");
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
     * @param file Audio file to transcribe
     * @param language Optional ISO-639-1 language code (e.g. "en", "ja")
     * @param audioDuration Optional duration in seconds for timeout calculation
     * @param model Transcription model to use (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe)
     */
    async transcribeAudio(
        file: File,
        language?: string,
        audioDuration?: number,
        model: string = "gpt-4o-mini-transcribe"
    ): Promise<string> {
        const url = `${API_ROOT}/audio/transcriptions`;
        const startedAt = Date.now();

        // Calculate timeout based on audio duration
        // Formula: 2x audio duration + 60s buffer, minimum 2 minutes
        const calculateTimeout = (durationSeconds?: number): number => {
            if (!durationSeconds) return 120000; // 2 min default
            const timeoutSec = Math.max(120, durationSeconds * 2 + 60);
            return timeoutSec * 1000;
        };

        const timeoutMs = calculateTimeout(audioDuration);
        const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);

        try {
            // Create form data
            const formData = new FormData();
            formData.append("file", file);
            formData.append("model", model);

            // GPT-4o models are used for context (text), Whisper-1 for subtitles (vtt)
            const isGpt4o = model.includes("gpt-4o");
            const responseFormat = isGpt4o ? "text" : "vtt";

            formData.append("response_format", responseFormat);

            // Only GPT-4o models support chunking_strategy
            if (isGpt4o) {
                formData.append("chunking_strategy", "auto");
            }

            // Add language if provided
            if (language) {
                formData.append("language", language);
            }

            // Setup abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.config.apiKey}`,
                    },
                    body: formData,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new ProviderTranslationError(
                        `Whisper API error (${response.status}): ${errorText}`
                    );
                }

                const content = await response.text();

                // For VTT mode (whisper-1), validate format
                if (!isGpt4o && (!content || !content.startsWith("WEBVTT"))) {
                    throw new ProviderTranslationError(
                        "Invalid VTT response from Whisper API"
                    );
                }

                const durationMs = Date.now() - startedAt;

                addProviderLog({
                    provider: "openai",
                    purpose: "transcribeAudio",
                    status: "ok",
                    model: model,
                    durationMs,
                    message: `Transcribed ${fileSizeMb}MB audio${audioDuration ? ` (${audioDuration.toFixed(1)}s)` : ""} in ${(durationMs / 1000).toFixed(1)}s (timeout: ${(timeoutMs / 1000).toFixed(0)}s)`,
                });

                return content;
            } catch (err) {
                clearTimeout(timeoutId);

                if (err instanceof Error && err.name === 'AbortError') {
                    throw new ProviderTranslationError(
                        `Transcription timeout after ${(timeoutMs / 1000).toFixed(0)}s`
                    );
                }
                throw err;
            }
        } catch (err) {
            addProviderLog({
                provider: "openai",
                purpose: "transcribeAudio",
                status: "error",
                model: model,
                durationMs: Date.now() - startedAt,
                message: err instanceof Error ? err.message : "Transcription failed",
            });
            throw err;
        }
    }
}
