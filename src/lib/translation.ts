import { chunkCues, type Chunk } from "./chunker";
import {
  buildUserPrompt,
  systemPromptTextOnly,
} from "./prompts";
import { deriveSrt, stitchVtt } from "./stitcher";
import { ProviderTranslationError } from "./providers";
import {
  autoRepairVtt,
  validateTimecodeConsistency,
  validateVtt,
} from "./validator";
import { parseVtt, serializeVtt, type Cue } from "./vtt";
import { MAX_CONCURRENCY } from "../config/defaults";
import type { ProviderType } from "./providers/types";
import { ProviderFactory } from "./providers/ProviderFactory";
import { buildStructuredUserPrompt } from "./structured/StructuredPrompt";
import { validateStructuredOutput } from "./structured/StructuredOutput";
import { reconstructVtt } from "./structured/VttReconstructor";

export type ChunkStatus = {
  idx: number;
  status: "ok" | "failed" | "processing" | "waiting" | "paused";
  tokens_estimate: number;
  warnings: string[];
  vtt: string;
  raw_model_output: string;
  raw_vtt: string;
  chunk_vtt: string;
  context_vtt: string;
  prompt: string;
  system_prompt?: string;
  started_at: number;
  finished_at: number;
  model_name?: string;
  temperature?: number;
  duration_ms?: number;
  // For transcription chunks - store time range for retry
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
};

function baseChunkStatus(
  chunk: Chunk,
  status: ChunkStatus["status"],
  extra?: Partial<ChunkStatus>,
): ChunkStatus {
  const chunkVtt = serializeVtt(chunk.cues);
  const contextVtt =
    chunk.prevContext.length > 0 ? serializeVtt(chunk.prevContext) : "";
  return {
    idx: chunk.idx,
    status,
    tokens_estimate: tokensEstimate(chunkVtt),
    warnings: [],
    vtt: "",
    raw_model_output: "",
    raw_vtt: "",
    chunk_vtt: chunkVtt,
    context_vtt: contextVtt,
    prompt: "",
    started_at: 0,
    finished_at: 0,
    ...extra,
  };
}

export type TranslateResult = {
  ok: boolean;
  warnings: string[];
  chunks: ChunkStatus[];
  vtt: string;
  srt: string;
  video_ref?: string | null;
};

type TranslateOptions = {
  cues: Cue[];
  provider: ProviderType;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  targetLang: string;
  glossary?: string;
  customPrompt?: string;
  videoUri?: string | null;
  videoLabel?: string | null;
  mediaKind?: "audio" | "video";
  summaryText?: string;
  useGlossary?: boolean;
  overlap?: number;
  targetSeconds?: number;
  concurrency?: number;
  onChunkUpdate?: (chunk: ChunkStatus) => void;
  temperature?: number;
  chunkQueue?: boolean;
  safetyOff?: boolean;
  shouldCancel?: () => boolean;
  shouldPause?: () => boolean;
  runId?: number;
  useStructuredOutput?: boolean;
};

type ChunkRetryOptions = {
  chunkVtt: string;
  contextVtt: string;
  idx: number;
  provider: ProviderType;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  targetLang: string;
  glossary?: string;
  customPrompt?: string;
  temperature?: number;
  summaryText?: string;
  useGlossary?: boolean;
  safetyOff?: boolean;
  runId?: number;
  useStructuredOutput?: boolean;
};

function tokensEstimate(text: string): number {
  return Math.max(Math.floor(text.length / 4), 1);
}

function cancelledChunk(chunk: Chunk): ChunkStatus {
  return baseChunkStatus(chunk, "failed", {
    warnings: ["Cancelled"],
    started_at: Date.now(),
    finished_at: Date.now(),
  });
}

function pausedChunk(chunk: Chunk): ChunkStatus {
  return baseChunkStatus(chunk, "paused");
}

async function translateChunk(
  chunk: Chunk,
  opts: Omit<
    TranslateOptions,
    "cues" | "targetSeconds" | "concurrency" | "onChunkUpdate"
  > & {
    shouldPause?: () => boolean;
    shouldCancel?: () => boolean;
  },
  onChunkUpdate?: (chunk: ChunkStatus) => void,
): Promise<ChunkStatus> {
  if (opts.shouldCancel?.()) return cancelledChunk(chunk);

  // Honor pause before kicking off provider work to avoid starting new calls while paused.
  while (opts.shouldPause?.()) {
    onChunkUpdate?.(pausedChunk(chunk));
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (opts.shouldCancel?.()) return cancelledChunk(chunk);
  }

  // Early exit if a reset/cancel happened while we waited.
  if (opts.shouldCancel?.()) return cancelledChunk(chunk);

  const chunkVtt = serializeVtt(chunk.cues);
  const contextVtt =
    chunk.prevContext.length > 0 ? serializeVtt(chunk.prevContext) : "";
  const startedAt = Date.now();
  onChunkUpdate?.(
    baseChunkStatus(chunk, "processing", {
      started_at: startedAt,
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
    }),
  );

  // Branch to structured output if enabled
  if (opts.useStructuredOutput) {
    return translateChunkStructured({
      chunkVtt,
      contextVtt,
      idx: chunk.idx,
      provider: opts.provider,
      apiKey: opts.apiKey,
      modelName: opts.modelName,
      baseUrl: opts.baseUrl,
      targetLang: opts.targetLang,
      glossary: opts.glossary,
      customPrompt: opts.customPrompt,
      temperature: opts.temperature,
      summaryText: opts.summaryText,
      useGlossary: opts.useGlossary,
      safetyOff: opts.safetyOff,
      runId: opts.runId,
      useStructuredOutput: true,
    });
  }

  return translateChunkFromText({
    chunkVtt,
    contextVtt,
    idx: chunk.idx,
    provider: opts.provider,
    apiKey: opts.apiKey,
    modelName: opts.modelName,
    baseUrl: opts.baseUrl,
    targetLang: opts.targetLang,
    glossary: opts.glossary,
    customPrompt: opts.customPrompt,
    temperature: opts.temperature,
    summaryText: opts.summaryText,
    useGlossary: opts.useGlossary,
    safetyOff: opts.safetyOff,
    runId: opts.runId,
  });
}

function isLooping(text: string, threshold = 10): boolean {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.includes("-->") && !/^WEBVTT/i.test(l));
  if (lines.length === 0) return false;

  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const next = (lineCounts.get(line) || 0) + 1;
    if (next >= threshold) return true;
    lineCounts.set(line, next);
  }

  const tokens = lines
    .join(" ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const tokenCounts = new Map<string, number>();
  for (const tok of tokens) {
    const next = (tokenCounts.get(tok) || 0) + 1;
    if (next >= 50) return true;
    tokenCounts.set(tok, next);
  }
  for (let i = 0; i < tokens.length - 2; i += 1) {
    const tri = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    const next = (tokenCounts.get(tri) || 0) + 1;
    if (next >= 20) return true;
    tokenCounts.set(tri, next);
  }
  return false;
}

export async function translateChunkFromText(
  opts: ChunkRetryOptions,
): Promise<ChunkStatus> {
  const warnings: string[] = [];
  const {
    chunkVtt,
    contextVtt,
    provider,
    apiKey,
    modelName,
    baseUrl,
    targetLang,
    glossary,
    customPrompt,
    temperature,
    summaryText,
    useGlossary,
    safetyOff,
  } = opts;
  const startedAt = Date.now();
  let parsedChunk: Cue[];
  try {
    parsedChunk = parseVtt(chunkVtt);
  } catch (err) {
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings: [err instanceof Error ? err.message : "Invalid chunk VTT"],
      vtt: "",
      raw_vtt: chunkVtt,
      raw_model_output: "",
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: "",
      started_at: startedAt,
      finished_at: Date.now(),
    };
  }
  // Build prompts
  const userPrompt = buildUserPrompt(
    targetLang,
    glossary,
    contextVtt,
    chunkVtt,
    summaryText,
    useGlossary,
  );
  const systemPrompt = systemPromptTextOnly(customPrompt);

  let translated = "";
  try {
    const providerType = provider;

    // Create provider instance
    const config = {
      apiKey: providerType !== "ollama" ? apiKey : undefined,
      modelName,
      baseUrl: providerType === "ollama" ? baseUrl ?? "http://localhost:11434" : baseUrl,
    };

    const providerInstance = ProviderFactory.create(providerType, config);

    // Prepare the request
    const request = {
      systemPrompt,
      userPrompt,
      temperature,
      // Note: videoUri is ignored here since it's passed as undefined in original code
      safetyOff,
    };

    const trace = {
      purpose: "translateChunk",
      chunkIdx: opts.idx,
      runId: opts.runId,
    };

    const response = await providerInstance.generateContent(request, trace);
    translated = response.text;
  } catch (err) {
    const warn =
      err instanceof ProviderTranslationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Translation failed";
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings: [warn],
      vtt: "",
      raw_vtt: "",
      raw_model_output: "",
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: userPrompt,
      system_prompt: systemPrompt,
      started_at: startedAt,
      finished_at: Date.now(),
    };
  }

  if (isLooping(translated)) {
    warnings.push("Detected repeated lines; review this chunk output.");
  }

  const rawModelOutput = translated;
  const autoRepair = autoRepairVtt(translated);
  if (autoRepair.warnings.length > 0) {
    const uniqueWarnings = Array.from(new Set(autoRepair.warnings));
    warnings.push(...uniqueWarnings);
  }

  let parsed = parsedChunk;
  try {
    parsed = parseVtt(autoRepair.repaired);
  } catch (err) {
    warnings.push(
      err instanceof Error ? err.message : "Parse failed after translation",
    );
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings,
      vtt: "",
      raw_vtt: autoRepair.repaired,
      raw_model_output: rawModelOutput,
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: userPrompt,
      system_prompt: systemPrompt,
      started_at: startedAt,
      finished_at: Date.now(),
    };
  }
  const hasText = parsed.some((c) => c.text.trim());
  const validation = validateVtt(autoRepair.repaired);
  warnings.push(...validation.warnings);
  const isOk = validation.errors.length === 0 && hasText;
  if (!hasText) {
    warnings.push("Model returned empty subtitle text for this chunk.");
  }
  if (!isOk) {
    warnings.push(...validation.errors);
  }

  // Enforce timecode consistency with source cues; auto-fix drift.
  const timecodeCheck = validateTimecodeConsistency(parsedChunk, parsed);
  warnings.push(...timecodeCheck.warnings);
  if (timecodeCheck.errors.length > 0) {
    warnings.push(...timecodeCheck.errors);
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings,
      vtt: "",
      raw_vtt: autoRepair.repaired,
      raw_model_output: rawModelOutput,
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: userPrompt,
      system_prompt: systemPrompt,
      started_at: startedAt,
      finished_at: Date.now(),
    };
  }

  // Re-serialize with fixed timecodes to ensure stable output
  const fixedVtt = serializeVtt(timecodeCheck.fixedCues);
  try {
    parseVtt(fixedVtt);
  } catch (err) {
    warnings.push(
      err instanceof Error ? err.message : "Parse failed after timecode fix",
    );
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings,
      vtt: "",
      raw_vtt: autoRepair.repaired,
      raw_model_output: rawModelOutput,
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: userPrompt,
      system_prompt: systemPrompt,
      started_at: startedAt,
      finished_at: Date.now(),
    };
  }

  return {
    idx: opts.idx,
    status: isOk ? "ok" : "failed",
    tokens_estimate: tokensEstimate(chunkVtt),
    warnings,
    vtt: isOk ? fixedVtt : "",
    raw_vtt: fixedVtt,
    raw_model_output: rawModelOutput,
    chunk_vtt: chunkVtt,
    context_vtt: contextVtt,
    prompt: userPrompt,
    system_prompt: systemPrompt,
    started_at: startedAt,
    finished_at: Date.now(),
  };
}

async function concurrentMap<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
  onItemDone?: (result: R) => void,
  onItemStart?: (idx: number) => void,
  shouldPause?: () => boolean,
  shouldCancel?: () => boolean,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const waitIfPaused = async () => {
    while (shouldPause?.()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (shouldCancel?.()) return true;
    }
    return false;
  };

  const runWorker = async () => {
    while (cursor < items.length) {
      if (shouldCancel?.()) return;
      if (await waitIfPaused()) return;
      const current = cursor;
      cursor += 1;
      onItemStart?.(current);
      const res = await worker(items[current], current);
      results[current] = res;
      if (onItemDone) {
        onItemDone(res);
      }
    }
  };
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, runWorker);
  await Promise.all(workers);
  return results;
}

export async function translateCues(
  opts: TranslateOptions,
): Promise<TranslateResult> {
  const {
    cues,
    provider,
    apiKey,
    modelName,
    baseUrl,
    targetLang,
    glossary,
    customPrompt,
    summaryText,
    useGlossary,
    targetSeconds = 600,
    overlap,
    concurrency,
    onChunkUpdate,
    temperature,
    safetyOff,
    useStructuredOutput,
  } = opts;
  const effectiveTarget = targetSeconds;
  const effectiveOverlap = (overlap ?? 2);
  const chunks = chunkCues(cues, effectiveTarget, effectiveOverlap);
  const requestedLimit =
    typeof concurrency === "number" ? concurrency : Math.max(1, chunks.length);
  const limit = Math.min(MAX_CONCURRENCY, Math.max(1, requestedLimit));

  let chunkResults: ChunkStatus[] = [];

  if (limit <= 1) {
    // Enforce strict sequential processing when concurrency is set to 1.
    const results: ChunkStatus[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (opts.shouldCancel?.()) {
        results.push(cancelledChunk(chunk));
        continue;
      }
      while (opts.shouldPause?.()) {
        onChunkUpdate?.(pausedChunk(chunk));
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (opts.shouldCancel?.()) {
          results.push(cancelledChunk(chunk));
          continue;
        }
      }
      const res = await translateChunk(chunk, {
        provider,
        apiKey,
        modelName,
        baseUrl,
        targetLang,
        glossary,
        customPrompt,
        temperature,
        summaryText,
        useGlossary,
        safetyOff,
        shouldPause: opts.shouldPause,
        shouldCancel: opts.shouldCancel,
        useStructuredOutput,
      });
      results.push(res);
      onChunkUpdate?.(res);
    }
    chunkResults = results;
  } else {
    chunkResults = await concurrentMap(
      chunks,
      limit,
      async (chunk) => {
        if (opts.shouldCancel?.()) return cancelledChunk(chunk);
        while (opts.shouldPause?.()) {
          onChunkUpdate?.(pausedChunk(chunk));
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (opts.shouldCancel?.()) return cancelledChunk(chunk);
        }
        onChunkUpdate?.({
          idx: chunk.idx,
          status: "processing",
          tokens_estimate: tokensEstimate(serializeVtt(chunk.cues)),
          warnings: [],
          vtt: "",
          raw_model_output: "",
          raw_vtt: "",
          chunk_vtt: serializeVtt(chunk.cues),
          context_vtt: chunk.prevContext.length
            ? serializeVtt(chunk.prevContext)
            : "",
          prompt: "",
          started_at: Date.now(),
          finished_at: 0,
        });
        return translateChunk(chunk, {
          provider,
          apiKey,
          modelName,
          baseUrl,
          targetLang,
          glossary,
          customPrompt,
          temperature,
          summaryText,
          useGlossary,
          safetyOff,
          shouldPause: opts.shouldPause,
          shouldCancel: opts.shouldCancel,
          runId: opts.runId,
          useStructuredOutput,
        });
      },
      (chunkResult) => onChunkUpdate?.(chunkResult),
      (idx) =>
        onChunkUpdate?.({
          idx,
          status: "processing",
          tokens_estimate: tokensEstimate(serializeVtt(chunks[idx].cues)),
          warnings: [],
          vtt: "",
          raw_model_output: "",
          raw_vtt: "",
          chunk_vtt: serializeVtt(chunks[idx].cues),
          context_vtt: chunks[idx].prevContext.length
            ? serializeVtt(chunks[idx].prevContext)
            : "",
          prompt: "",
          started_at: Date.now(),
          finished_at: 0,
        }),
      opts.shouldPause,
      opts.shouldCancel,
    );
  }

  const successfulParts = chunkResults
    .filter((r) => r.status === "ok")
    .map((r) => r.vtt);
  const finalVtt = successfulParts.length > 0 ? stitchVtt(successfulParts) : "";
  const finalSrt = finalVtt ? deriveSrt(finalVtt) : "";
  const overallOk = chunkResults.every((r) => r.status === "ok");
  const warnings = chunkResults.flatMap((r) => r.warnings);

  return {
    ok: overallOk,
    warnings,
    chunks: chunkResults,
    vtt: finalVtt,
    srt: finalSrt,
    video_ref: opts.videoUri, // Return the video reference that was passed in
  };
}

export async function translateChunkStructured(
  opts: ChunkRetryOptions,
): Promise<ChunkStatus> {
  const warnings: string[] = [];
  const {
    chunkVtt,
    contextVtt,
    provider,
    apiKey,
    modelName,
    baseUrl,
    targetLang,
    glossary,
    customPrompt,
    temperature,
    summaryText,
    useGlossary,
    safetyOff,
  } = opts;
  const startedAt = Date.now();

  let cues: Cue[] = [];
  try {
    cues = parseVtt(chunkVtt);
  } catch {
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings: ["Invalid VTT input for structured translation"],
      vtt: "", raw_vtt: chunkVtt, raw_model_output: "", chunk_vtt: chunkVtt, context_vtt: contextVtt, prompt: "", started_at: startedAt, finished_at: Date.now()
    };
  }

  // Build Structured Prompt
  const userPrompt = buildStructuredUserPrompt(
    cues,
    targetLang,
    useGlossary ? glossary : undefined,
    contextVtt,
    summaryText
  );

  // Create provider
  const config = {
    apiKey: provider !== "ollama" ? apiKey : undefined,
    modelName,
    baseUrl: provider === "ollama" ? baseUrl || "http://localhost:11434" : baseUrl,
  };
  const providerInstance = ProviderFactory.create(provider, config);

  // Determine system prompt: use custom if provided, otherwise default structured one.
  const systemPromptTemplate = customPrompt && customPrompt.trim().length > 10
    ? customPrompt
    : (await import("../config/defaults")).STRUCTURED_SYSTEM_PROMPT;

  const systemPrompt = systemPromptTemplate.replace(/<target>/g, targetLang);

  const request = {
    systemPrompt,
    userPrompt,
    temperature,
    safetyOff,
    responseMimeType: "application/json"
  };

  const trace = { purpose: "translateChunkStructured", chunkIdx: opts.idx, runId: opts.runId };

  let rawModelOutput = "";
  try {
    try {
      const response = await providerInstance.generateContent(request, trace);
      rawModelOutput = response.text;
    } catch (err) {
      // Fallback: If API (specifically Google Gemini) complains that JSON mode is not enabled for this model,
      // retry without the enforcement flag. The system prompt still requests JSON.
      if (err instanceof Error && err.message.includes("JSON mode is not enabled")) {
        const fallbackRequest = { ...request, responseMimeType: undefined };
        const response = await providerInstance.generateContent(fallbackRequest, trace);
        rawModelOutput = response.text;
      } else {
        throw err;
      }
    }

    let json: unknown;
    try {
      json = JSON.parse(rawModelOutput);
    } catch {
      // Fallback extraction
      const match = rawModelOutput.match(/```json\n([\s\S]*?)\n```/) || rawModelOutput.match(/```\n([\s\S]*?)\n```/);
      if (match) {
        json = JSON.parse(match[1]);
      } else {
        throw new Error("Failed to parse JSON response");
      }
    }

    const validated = validateStructuredOutput(json);
    const result = reconstructVtt(validated, cues);

    warnings.push(...result.warnings);

    return {
      idx: opts.idx,
      status: "ok",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings,
      vtt: result.vtt,
      raw_vtt: result.vtt,
      raw_model_output: rawModelOutput,
      chunk_vtt: chunkVtt,
      context_vtt: contextVtt,
      prompt: userPrompt,
      started_at: startedAt,
      finished_at: Date.now()
    };

  } catch (err) {
    return {
      idx: opts.idx,
      status: "failed",
      tokens_estimate: tokensEstimate(chunkVtt),
      warnings: [err instanceof Error ? err.message : "Structure translation failed"],
      vtt: "", raw_vtt: "", raw_model_output: rawModelOutput, chunk_vtt: chunkVtt, context_vtt: contextVtt, prompt: userPrompt, started_at: startedAt, finished_at: Date.now()
    };
  }
}
