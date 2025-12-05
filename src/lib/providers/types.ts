/**
 * Provider abstraction layer types and interfaces
 */

export type ProviderType = "gemini" | "openai" | "anthropic" | "ollama";

export type ProviderCapabilities = {
    supportsMediaUpload: boolean;
    supportsVision: boolean;
    supportsTemperature: boolean;
    supportsSafetySettings: boolean;
    requiresApiKey: boolean;
    supportsStreaming: boolean;
    // Audio transcription capabilities
    canTranscribeAudio?: boolean;  // Can transcribe audio to VTT (e.g., OpenAI Whisper)
};

export type ModelInfo = {
    id: string;
    displayName: string;
    provider: ProviderType;
    description?: string;
};

export type UsageInfo = {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
};

export type ProviderError = {
    message: string;
    code?: string;
    statusCode?: number;
    isRateLimited?: boolean;
    retryAfter?: number;
};

export type GenerateRequest = {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    mediaUri?: string;
    mediaStartSeconds?: number;
    mediaEndSeconds?: number;
    mediaInlineData?: {
        mimeType: string;
        data: string; // base64 encoded
    };
    safetyOff?: boolean;
    // Provider-specific options can be added here
    providerOptions?: Record<string, unknown>;
};

export type GenerateResponse = {
    text: string;
    usage?: UsageInfo;
};

export type ProviderConfig = {
    apiKey?: string;
    baseUrl?: string;
    modelName: string;
    // Provider-specific configuration
    options?: Record<string, unknown>;
};

export type ProviderTrace = {
    purpose: string;
    chunkIdx?: number;
    runId?: number;
};

/**
 * Main provider interface that all providers must implement
 */
export interface TranslationProvider {
    readonly type: ProviderType;
    readonly capabilities: ProviderCapabilities;

    /**
     * Generate content using the provider's API
     */
    generateContent(
        request: GenerateRequest,
        trace?: ProviderTrace,
    ): Promise<GenerateResponse>;

    /**
     * List available models from this provider
     */
    listModels(): Promise<ModelInfo[]>;

    /**
     * Get provider information
     */
    getProviderInfo(): {
        name: string;
        description: string;
        capabilities: ProviderCapabilities;
    };

    /**
     * Validate the configuration for this provider
     */
    validateConfig(config: ProviderConfig): boolean;

    /**
     * Upload media for context (optional, only for providers that support it)
     */
    uploadMedia?(
        file: File,
    ): Promise<{ fileUri: string; fileName?: string }>;

    /**
     * Delete uploaded media (optional)
     */
    deleteMedia?(fileNameOrUri: string): Promise<void>;

    /**
     * Transcribe audio file to text
     * @param file Audio file to transcribe
     * @param language Optional language code
     * @param audioDuration Optional duration in seconds for timeout calculation
     * @param model Optional transcription model (defaults to gpt-4o-mini-transcribe)
     */
    transcribeAudio?(
        file: File,
        language?: string,
        audioDuration?: number,
        model?: string
    ): Promise<string>;  // Returns VTT content as string
}
