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
import { addProviderLog, updateProviderLog } from "../providerLog";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta";

/**
 * Gemini provider implementation
 */
export class GeminiProvider extends BaseProvider {
    readonly type = "gemini" as const;
    readonly capabilities: ProviderCapabilities = {
        supportsMediaUpload: true,
        supportsVision: true,
        supportsTemperature: true,
        supportsSafetySettings: true,
        requiresApiKey: true,
        supportsStreaming: false,
    };

    private normalizeModel(modelName: string): string {
        return modelName.startsWith("models/") ? modelName : `models/${modelName}`;
    }

    getProviderInfo() {
        return {
            name: "Google Gemini",
            description: "Google's multimodal AI models with vision and media support",
            capabilities: this.capabilities,
        };
    }

    validateConfig(config: ProviderConfig): boolean {
        if (!super.validateConfig(config)) return false;
        if (!config.apiKey) return false;
        return true;
    }

    private extractUsage(data: unknown): UsageInfo | undefined {
        const usage =
            (data as { usageMetadata?: unknown })?.usageMetadata ||
            (data as { usage_metadata?: unknown })?.usage_metadata;
        if (!usage || typeof usage !== "object") return undefined;
        const u = usage as Record<string, unknown>;
        return {
            promptTokens:
                (typeof u.promptTokenCount === "number"
                    ? u.promptTokenCount
                    : typeof u.prompt_token_count === "number"
                        ? u.prompt_token_count
                        : typeof u.prompt_tokens === "number"
                            ? u.prompt_tokens
                            : undefined) ?? undefined,
            responseTokens:
                (typeof u.candidatesTokenCount === "number"
                    ? u.candidatesTokenCount
                    : typeof u.candidates_token_count === "number"
                        ? u.candidates_token_count
                        : typeof u.response_tokens === "number"
                            ? u.response_tokens
                            : undefined) ?? undefined,
            totalTokens:
                (typeof u.totalTokenCount === "number"
                    ? u.totalTokenCount
                    : typeof u.total_token_count === "number"
                        ? u.total_token_count
                        : typeof u.total_tokens === "number"
                            ? u.total_tokens
                            : undefined) ?? undefined,
        };
    }

    async generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse> {
        const {
            systemPrompt,
            userPrompt,
            temperature,
            safetyOff,
            mediaUri,
            mediaInlineData,
            responseMimeType,
            responseJsonSchema,
            thinkingConfig,
        } = request;
        const normalized = this.normalizeModel(this.config.modelName);
        const url = `${API_ROOT}/${normalized}:generateContent?key=${encodeURIComponent(this.config.apiKey!)}`;
        const startedAt = Date.now();

        const parts: unknown[] = [];

        // Prefer inline data over file URI for better chunking
        if (mediaInlineData) {
            // Note: docs recommend placing media before text in contents; we push media part first intentionally.
            parts.push({
                inlineData: {
                    mimeType: mediaInlineData.mimeType,
                    data: mediaInlineData.data,
                },
            });
        } else if (mediaUri) {
            const formatDurationSeconds = (value?: number, isEnd?: boolean) => {
                if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
                const safe = Math.max(0, value);
                const rounded = isEnd ? Math.ceil(safe) : Math.floor(safe);
                return `${rounded}s`;
            };

            const startOffset = formatDurationSeconds(request.mediaStartSeconds, false);
            const endOffset = formatDurationSeconds(request.mediaEndSeconds, true);
            const hasOffsets = Boolean(startOffset || endOffset);
            const part: Record<string, unknown> = {
                fileData: { fileUri: mediaUri },
            };
            if (hasOffsets) {
                part.videoMetadata = {
                    startOffset,
                    endOffset,
                };
            }
            parts.push(part);
        }
        parts.push({ text: userPrompt });

        // Gemma models don't support system_instruction - prepend to user message instead
        const isGemmaModel = normalized.toLowerCase().includes("gemma");

        const body: Record<string, unknown> = {
            contents: [{ role: "user", parts }],
        };

        // Only add system_instruction for non-Gemma models
        if (!isGemmaModel && systemPrompt) {
            body.system_instruction = { parts: [{ text: systemPrompt }] };
        } else if (isGemmaModel && systemPrompt) {
            // For Gemma, prepend system prompt to the first text part
            const textPartIndex = parts.findIndex((p: unknown) =>
                typeof p === "object" && p !== null && "text" in p
            );
            if (textPartIndex !== -1) {
                const textPart = parts[textPartIndex] as { text: string };
                textPart.text = `${systemPrompt}\n\n${textPart.text}`;
            }
        }

        const generationConfig: Record<string, unknown> = {};
        if (typeof temperature === "number") {
            generationConfig.temperature = temperature;
        }
        if (responseMimeType) {
            generationConfig.responseMimeType = responseMimeType;
        }
        if (responseJsonSchema) {
            generationConfig.responseJsonSchema = responseJsonSchema;
        }
        if (thinkingConfig) {
            generationConfig.thinkingConfig = thinkingConfig;
        }
        if (typeof request.maxOutputTokens === "number") {
            generationConfig.maxOutputTokens = request.maxOutputTokens;
        }
        if (typeof request.topP === "number") {
            generationConfig.topP = request.topP;
        }
        if (typeof request.topK === "number") {
            generationConfig.topK = request.topK;
        }
        if (Object.keys(generationConfig).length > 0) {
            body.generationConfig = generationConfig;
        }

        if (safetyOff) {
            body.safetySettings = [
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            ];
        }

        const callApi = async (): Promise<GenerateResponse> => {
            // Log request immediately with pending status
            const logId = addProviderLog({
                provider: "gemini",
                purpose: trace?.purpose || "generateContent",
                status: "pending",
                model: normalized,
                temperature,
                safetyOff: !!safetyOff,
                chunkIdx: trace?.chunkIdx,
                runId: trace?.runId,
                message: "Request sent...",
            });

            try {
                const data = await this.requestJson(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                const text =
                    (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
                        .candidates?.[0]?.content?.parts
                        ?.map((part: { text?: string }) => part.text || "")
                        .join("")
                        .trim() || "";

                if (!text) {
                    throw new ProviderTranslationError("Empty response from Gemini");
                }

                const usage = this.extractUsage(data);

                // Update log with success status
                updateProviderLog(logId, {
                    status: "ok",
                    durationMs: Date.now() - startedAt,
                    tokens: usage,
                    message: undefined, // Clear "Request sent..." message
                });

                return { text, usage };
            } catch (err) {
                // Update log with error status
                updateProviderLog(logId, {
                    status: "error",
                    durationMs: Date.now() - startedAt,
                    message:
                        err instanceof Error ? err.message : "Gemini generateContent failed",
                });
                throw err;
            }
        };

        return withRetry(callApi);
    }

    async listModels(): Promise<ModelInfo[]> {
        const url = `${API_ROOT}/models?key=${encodeURIComponent(this.config.apiKey!)}`;
        const startedAt = Date.now();

        try {
            const data = await this.requestJson(url, { method: "GET" });
            const models = Array.isArray((data as { models?: unknown }).models)
                ? (data as { models: unknown[] }).models
                : [];

            addProviderLog({
                provider: "gemini",
                purpose: "listModels",
                status: "ok",
                durationMs: Date.now() - startedAt,
            });

            return models
                .filter((m) => {
                    const methods =
                        (m as { supportedGenerationMethods?: string[] }).supportedGenerationMethods ||
                        (m as { supported_generation_methods?: string[] }).supported_generation_methods ||
                        [];
                    return Array.isArray(methods) && methods.includes("generateContent");
                })
                .map((m) => ({
                    id: (m as { name: string }).name,
                    displayName: (m as { name: string }).name.replace("models/", ""),
                    provider: "gemini" as const,
                    description: (m as { description?: string }).description,
                }));
        } catch (err) {
            addProviderLog({
                provider: "gemini",
                purpose: "listModels",
                status: "error",
                durationMs: Date.now() - startedAt,
                message: err instanceof Error ? err.message : "Failed to list models",
            });
            throw err;
        }
    }

    async uploadMedia(
        file: File,
    ): Promise<{ fileUri: string; fileName?: string }> {
        const boundary = `gaki-${Date.now()}`;
        const displayName = file.name.slice(0, 80);
        const metadata = JSON.stringify({ file: { display_name: displayName } });
        const body = new Blob(
            [
                `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
                metadata,
                `\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
                file,
                `\r\n--${boundary}--`,
            ],
            { type: `multipart/related; boundary=${boundary}` },
        );

        const uploadUrl = `${UPLOAD_ROOT}/files?key=${encodeURIComponent(this.config.apiKey!)}&uploadType=multipart`;
        const startedAt = Date.now();

        const uploadData = await this.requestJson(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body,
        }).catch((err) => {
            addProviderLog({
                provider: "gemini",
                purpose: "uploadContextVideo",
                status: "error",
                durationMs: Date.now() - startedAt,
                message: err instanceof Error ? err.message : "Upload failed",
            });
            throw err;
        });

        const fileUri =
            (uploadData as { file?: { uri?: string }; fileUri?: string; uri?: string }).file?.uri ||
            (uploadData as { fileUri?: string }).fileUri ||
            (uploadData as { uri?: string }).uri ||
            "";
        const fileName =
            (uploadData as { file?: { name?: string }; name?: string }).file?.name ||
            (uploadData as { name?: string }).name ||
            "";

        if (!fileUri && !fileName) {
            throw new ProviderTranslationError(
                "Gemini upload did not return a file reference",
            );
        }

        // Poll file status until ACTIVE
        const path =
            fileName && fileName.startsWith("files/")
                ? fileName
                : fileName
                    ? `files/${fileName}`
                    : fileUri;

        const statusUrl = `${API_ROOT}/${path}?key=${encodeURIComponent(this.config.apiKey!)}`;
        let isActive = false;
        let lastState: string | undefined;

        // Poll longer to allow processing large files (up to ~3 minutes)
        const maxPolls = 30;
        for (let i = 0; i < maxPolls; i += 1) {
            try {
                const info = await this.requestJson(statusUrl, { method: "GET" });
                const state =
                    (info as { file?: { state?: string }; state?: string; metadata?: { state?: string } })
                        .file?.state ||
                    (info as { state?: string }).state ||
                    (info as { metadata?: { state?: string } }).metadata?.state ||
                    "UNKNOWN";
                lastState = typeof state === "string" ? state : "UNKNOWN";
                if (lastState === "ACTIVE") {
                    isActive = true;
                    break;
                }
            } catch {
                // ignore and retry
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        addProviderLog({
            provider: "gemini",
            purpose: "uploadContextVideo",
            status: isActive ? "ok" : "error",
            durationMs: Date.now() - startedAt,
            message: isActive
                ? "Upload finished, processing complete."
                : `Upload finished, but file not ACTIVE (last state: ${lastState ?? "unknown"})`,
        });

        return { fileUri, fileName };
    }

    async deleteMedia(fileNameOrUri: string): Promise<void> {
        const trimmed = fileNameOrUri.trim();
        const path = trimmed.startsWith("files/") ? trimmed : `files/${trimmed}`;
        const url = `${API_ROOT}/${path}?key=${encodeURIComponent(this.config.apiKey!)}`;
        const startedAt = Date.now();

        const resp = await fetch(url, { method: "DELETE" });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            addProviderLog({
                provider: "gemini",
                purpose: "deleteUploadedFile",
                status: "error",
                durationMs: Date.now() - startedAt,
                message: text || `Failed to delete ${path} (${resp.status})`,
            });
            throw new ProviderTranslationError(
                text || `Failed to delete ${path} (${resp.status})`,
            );
        }

        addProviderLog({
            provider: "gemini",
            purpose: "deleteUploadedFile",
            status: "ok",
            durationMs: Date.now() - startedAt,
        });
    }
}

// Re-export error for backward compatibility
export { ProviderTranslationError as GeminiTranslationError };
