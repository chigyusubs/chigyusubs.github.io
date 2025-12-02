import { addGeminiLog, type GeminiTrace, type GeminiUsage } from "./geminiLog";
import { clearRateLimitWait, setRateLimitWait } from "./rateLimit";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta";

export class GeminiTranslationError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeModel(modelName: string): string {
  return modelName.startsWith("models/") ? modelName : `models/${modelName}`;
}

type RequestInitCompat = globalThis.RequestInit;

async function requestJson(url: string, init: RequestInitCompat) {
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
      data?.error?.message ||
      data?.message ||
      data?.detail ||
      (rawText
        ? `${resp.status} ${resp.statusText}: ${rawText}`
        : `${resp.status} ${resp.statusText} (Request failed)`);
    throw new GeminiTranslationError(detail);
  }
  return data;
}

export async function listModels(apiKey: string): Promise<string[]> {
  const url = `${API_ROOT}/models?key=${encodeURIComponent(apiKey)}`;
  const startedAt = Date.now();
  try {
    const data = await requestJson(url, { method: "GET" });
    const models = Array.isArray(data.models) ? data.models : [];
    addGeminiLog({
      purpose: "listModels",
      status: "ok",
      durationMs: Date.now() - startedAt,
    });
    return models
      .filter((m) => {
        const methods =
          m.supportedGenerationMethods || m.supported_generation_methods || [];
        return Array.isArray(methods) && methods.includes("generateContent");
      })
      .map((m) => m.name as string);
  } catch (err) {
    addGeminiLog({
      purpose: "listModels",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : "Failed to list models",
    });
    throw err;
  }
}

type GenerateOptions = {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  videoUri?: string;
  temperature?: number;
  safetyOff?: boolean;
  trace?: GeminiTrace;
  mediaResolution?: "low" | "standard";
};

export type GenerateContentResult = {
  text: string;
  usage?: GeminiUsage;
};

function extractUsage(data: unknown): GeminiUsage | undefined {
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

async function callGenerateContent(
  opts: GenerateOptions,
): Promise<GenerateContentResult> {
  const {
    apiKey,
    modelName,
    systemPrompt,
    userPrompt,
    videoUri,
    temperature,
    safetyOff,
    trace,
    mediaResolution,
  } = opts;
  const normalized = normalizeModel(modelName);
  const url = `${API_ROOT}/${normalized}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const startedAt = Date.now();

  const parts: unknown[] = [];
  if (videoUri) {
    parts.push({ fileData: { fileUri: videoUri } });
  }
  parts.push({ text: userPrompt });

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    system_instruction: { parts: [{ text: systemPrompt }] },
  };
  if (typeof temperature === "number" || mediaResolution) {
    const resolutionValue =
      mediaResolution === "low"
        ? "MEDIA_RESOLUTION_LOW"
        : mediaResolution === "standard"
          ? "MEDIA_RESOLUTION_STANDARD"
          : undefined;
    body.generationConfig = {
      ...(typeof temperature === "number" ? { temperature } : {}),
      ...(resolutionValue ? { mediaResolution: resolutionValue } : {}),
    };
  }
  if (safetyOff) {
    body.safetySettings = [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    ];
  }

  try {
    const data = await requestJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "")
        .join("")
        .trim() || "";
    if (!text) {
      throw new GeminiTranslationError("Empty response from Gemini");
    }
    const usage = extractUsage(data);
    addGeminiLog({
      purpose: trace?.purpose || "generateContent",
      status: "ok",
      model: normalized,
      temperature,
      safetyOff: !!safetyOff,
      durationMs: Date.now() - startedAt,
      chunkIdx: trace?.chunkIdx,
      runId: trace?.runId,
      tokens: usage,
    });
    return { text, usage };
  } catch (err) {
    addGeminiLog({
      purpose: trace?.purpose || "generateContent",
      status: "error",
      model: normalized,
      temperature,
      safetyOff: !!safetyOff,
      durationMs: Date.now() - startedAt,
      chunkIdx: trace?.chunkIdx,
      runId: trace?.runId,
      message:
        err instanceof Error ? err.message : "Gemini generateContent failed",
    });
    throw err;
  }
}

function isRateLimited(err: unknown): boolean {
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

function parseRetryAfter(err: unknown): number | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry in ([0-9]+(?:\.[0-9]+)?)/i);
  if (match) {
    const seconds = parseFloat(match[1]);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds;
  }
  return undefined;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const result = await fn();
      clearRateLimitWait();
      return result;
    } catch (err) {
      lastError = err;
      const retryAfter = parseRetryAfter(err);
      if (isRateLimited(err)) {
        if (i < attempts - 1) {
          const delayMs = Math.min(
            120_000,
            Math.max(1000, (retryAfter ?? 2 ** i) * 1000),
          );
          setRateLimitWait(delayMs);
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
    : new Error("Unknown Gemini error");
}

export async function translateChunkText(
  opts: GenerateOptions,
): Promise<GenerateContentResult> {
  return withRetry(() => callGenerateContent(opts));
}

export async function uploadContextVideo(
  file: File,
  apiKey: string,
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
  const uploadUrl = `${UPLOAD_ROOT}/files?key=${encodeURIComponent(apiKey)}&uploadType=multipart`;
  const startedAt = Date.now();
  const uploadData = await requestJson(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  }).catch((err) => {
    addGeminiLog({
      purpose: "uploadContextVideo",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : "Upload failed",
    });
    throw err;
  });
  const fileUri =
    uploadData.file?.uri || uploadData.fileUri || uploadData.uri || "";
  const fileName = uploadData.file?.name || uploadData.name || "";
  if (!fileUri && !fileName) {
    throw new GeminiTranslationError(
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

  const statusUrl = `${API_ROOT}/${path}?key=${encodeURIComponent(apiKey)}`;
  let isActive = false;
  let lastState: string | undefined;
  for (let i = 0; i < 8; i += 1) {
    try {
      const info = await requestJson(statusUrl, { method: "GET" });
      const state =
        info?.file?.state || info?.state || info?.metadata?.state || "UNKNOWN";
      lastState = typeof state === "string" ? state : "UNKNOWN";
      if (lastState === "ACTIVE") {
        isActive = true;
        break;
      }
    } catch {
      // ignore and retry
    }
    await sleep(1000);
  }

  addGeminiLog({
    purpose: "uploadContextVideo",
    status: isActive ? "ok" : "error",
    durationMs: Date.now() - startedAt,
    message: isActive
      ? "Upload finished, processing complete."
      : `Upload finished, but file not ACTIVE (last state: ${lastState ?? "unknown"})`,
  });

  return { fileUri, fileName };
}

export async function deleteUploadedFile(
  fileNameOrUri: string,
  apiKey: string,
): Promise<void> {
  const trimmed = fileNameOrUri.trim();
  const path = trimmed.startsWith("files/") ? trimmed : `files/${trimmed}`;
  const url = `${API_ROOT}/${path}?key=${encodeURIComponent(apiKey)}`;
  const startedAt = Date.now();
  const resp = await fetch(url, { method: "DELETE" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    addGeminiLog({
      purpose: "deleteUploadedFile",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: text || `Failed to delete ${path} (${resp.status})`,
    });
    throw new GeminiTranslationError(
      text || `Failed to delete ${path} (${resp.status})`,
    );
  }
  addGeminiLog({
    purpose: "deleteUploadedFile",
    status: "ok",
    durationMs: Date.now() - startedAt,
  });
}
