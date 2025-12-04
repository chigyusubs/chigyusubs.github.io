import type {
    ProviderCapabilities,
    ProviderConfig,
    ProviderType,
    TranslationProvider,
} from "./types";

/**
 * Base error class for provider errors
 */
export class ProviderTranslationError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly statusCode?: number,
        public readonly isRateLimited = false,
        public readonly retryAfter?: number,
    ) {
        super(message);
        this.name = "ProviderTranslationError";
    }
}

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error indicates rate limiting
 */
export function isRateLimitError(err: unknown): boolean {
    if (err instanceof ProviderTranslationError && err.isRateLimited) {
        return true;
    }
    const msg =
        err instanceof Error
            ? err.message.toLowerCase()
            : String(err).toLowerCase();
    return (
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("429") ||
        msg.includes("too many requests")
    );
}

/**
 * Parse retry-after from error message
 */
export function parseRetryAfter(err: unknown): number | undefined {
    if (err instanceof ProviderTranslationError && err.retryAfter) {
        return err.retryAfter;
    }
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/retry in ([0-9]+(?:\.[0-9]+)?)/i);
    if (match) {
        const seconds = parseFloat(match[1]);
        if (!Number.isNaN(seconds) && seconds > 0) return seconds;
    }
    return undefined;
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    attempts = 2,
): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const retryAfter = parseRetryAfter(err);
            if (isRateLimitError(err)) {
                if (i < attempts - 1) {
                    const delayMs = Math.min(
                        120_000,
                        Math.max(1000, (retryAfter ?? 2 ** i) * 1000),
                    );
                    await sleep(delayMs);
                    continue;
                }
                break; // out of attempts
            }
            if (i < attempts - 1) {
                const delayMs = Math.min(4000, 1000 * 2 ** i);
                await sleep(delayMs);
            }
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error("Unknown provider error");
}

/**
 * Abstract base provider with common functionality
 */
export abstract class BaseProvider implements TranslationProvider {
    abstract readonly type: ProviderType;
    abstract readonly capabilities: ProviderCapabilities;

    constructor(protected config: ProviderConfig) { }

    abstract generateContent(
        request: import("./types").GenerateRequest,
        trace?: import("./types").ProviderTrace,
    ): Promise<import("./types").GenerateResponse>;

    abstract listModels(): Promise<import("./types").ModelInfo[]>;

    abstract getProviderInfo(): {
        name: string;
        description: string;
        capabilities: ProviderCapabilities;
    };

    validateConfig(config: ProviderConfig): boolean {
        // Base validation - can be overridden
        if (this.capabilities.requiresApiKey && !config.apiKey) {
            return false;
        }
        if (!config.modelName) {
            return false;
        }
        return true;
    }

    /**
     * Helper to make JSON requests with error handling
     */
    protected async requestJson(
        url: string,
        init: RequestInit,
    ): Promise<unknown> {
        const resp = await fetch(url, init);
        const rawText = await resp.text().catch(() => "");
        let data: unknown = {};
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {
            data = {};
        }
        if (!resp.ok) {
            const detail =
                (data as { error?: { message?: string } })?.error?.message ||
                (data as { message?: string })?.message ||
                (data as { detail?: string })?.detail ||
                (rawText
                    ? `${resp.status} ${resp.statusText}: ${rawText}`
                    : `${resp.status} ${resp.statusText} (Request failed)`);
            throw new ProviderTranslationError(
                detail,
                undefined,
                resp.status,
                resp.status === 429,
            );
        }
        return data;
    }
}
