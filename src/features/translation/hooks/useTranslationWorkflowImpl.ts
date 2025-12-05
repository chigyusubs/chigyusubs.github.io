import { useState, useMemo, useEffect } from "react";
import {
  DEFAULT_CHUNK_SECONDS,
  DEFAULT_CONCURRENCY,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_OVERLAP_CUES,
  DEFAULT_SUMMARY_FILE_LABELS,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
  DEFAULT_TARGET_LANG,
  DEFAULT_TEMPERATURE,
  DEFAULT_USER_PROMPT_STRUCTURE,
  DEFAULT_USE_GLOSSARY,
  DEFAULT_USE_SUMMARY,
  MAX_CONCURRENCY,
  PROMPT_PRESETS,
  type PromptPresetId,
} from "../../../config/defaults";
import {
  buildSummaryUserPrompt,
  buildUserPrompt,
  glossarySystemPrompt,
  summarySystemPrompt,
} from "../../../lib/prompts";
import { deriveSrt } from "../../../lib/stitcher";
import { autoRepairVtt } from "../../../lib/validator";
import { useTranslationRunner } from "../../../hooks/useTranslationRunner";
import {
  type CustomPreset,
  createPresetFromCurrent,
  downloadPresetFile,
  importPresets,
} from "../../../lib/presetImportExport";
import { useMemoizedPresetPrompt } from "./useMemoizedPresetPrompt";
import { parseVtt, parseSrt } from "../../../lib/vtt";
import { ProviderFactory } from "../../../lib/providers/ProviderFactory";
import type { GenerateRequest, ProviderType } from "../../../lib/providers/types";
import type { Cue } from "../../../lib/vtt";
import type { ChunkStatus } from "../../../lib/translation";

type SavedPrefs = {
  targetLang?: string;
  concurrency?: number;
  chunkSeconds?: number;
  chunkOverlap?: number;
  customPrompt?: string;
  glossary?: string;
  useGlossary?: boolean;
  temperature?: number;
  summaryText?: string;
  summaryPrompt?: string;
  useSummary?: boolean;
  glossaryPrompt?: string;
  useGlossaryInSummary?: boolean;
};

export function useTranslationWorkflow(saved?: SavedPrefs) {
  const { state: runnerState, actions: runnerActions } = useTranslationRunner();

  const [targetLang, setTargetLang] = useState(
    saved?.targetLang ?? DEFAULT_TARGET_LANG,
  );
  const [concurrency, setConcurrency] = useState<number>(
    saved?.concurrency ?? DEFAULT_CONCURRENCY,
  );
  const [chunkSeconds, setChunkSeconds] = useState<number>(
    saved?.chunkSeconds ?? DEFAULT_CHUNK_SECONDS,
  );
  const [chunkOverlap, setChunkOverlap] = useState<number>(
    saved?.chunkOverlap ?? DEFAULT_OVERLAP_CUES,
  );
  const [customPrompt, setCustomPrompt] = useState(
    saved?.customPrompt ?? DEFAULT_SYSTEM_PROMPT_TEXT,
  );
  const [glossary, setGlossary] = useState(saved?.glossary ?? "");
  const [useGlossary, setUseGlossary] = useState(
    saved?.useGlossary ?? DEFAULT_USE_GLOSSARY,
  );
  const [temperature, setTemperature] = useState(
    saved?.temperature ?? DEFAULT_TEMPERATURE,
  );
  const [summaryText, setSummaryText] = useState(saved?.summaryText ?? "");
  const [summaryStatus, setSummaryStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [summaryError, setSummaryError] = useState("");
  const [glossaryStatus, setGlossaryStatus] = useState<"idle" | "loading">(
    "idle",
  );
  const [glossaryError, setGlossaryError] = useState("");
  const [summaryPrompt, setSummaryPrompt] = useState(
    saved?.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT,
  );
  const [useSummary, setUseSummary] = useState(
    saved?.useSummary ?? DEFAULT_USE_SUMMARY,
  );
  const [glossaryPrompt, setGlossaryPrompt] = useState(
    saved?.glossaryPrompt ?? DEFAULT_GLOSSARY_PROMPT,
  );
  const [currentPreset, setCurrentPreset] = useState<PromptPresetId | "">(
    "general",
  );
  const [useGlossaryInSummary, setUseGlossaryInSummary] = useState(
    saved?.useGlossaryInSummary ?? false,
  );
  const [promptPreview, setPromptPreview] = useState("");
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    if (saved?.customPresets) return saved.customPresets;
    try {
      const stored = window.localStorage.getItem("customPresets");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useMemoizedPresetPrompt({
    currentPreset,
    customPrompt,
    customPresets,
    setPromptPreview,
  });

  useEffect(() => {
    try {
      if (customPresets.length === 0) {
        window.localStorage.removeItem("customPresets");
      } else {
        window.localStorage.setItem(
          "customPresets",
          JSON.stringify(customPresets),
        );
      }
    } catch {
      // ignore storage errors
    }
  }, [customPresets]);

  const clampedConcurrency = (value: number) =>
    Math.min(MAX_CONCURRENCY, Math.max(1, value));

  const normalizeCustomPrompt = (value: string) => {
    const trimmed = value.trim();
    return trimmed && trimmed === DEFAULT_SYSTEM_PROMPT_TEXT.trim()
      ? ""
      : trimmed;
  };

  const buildPrompts = ({
    glossaryText,
    useGloss,
    summary,
  }: {
    glossaryText: string;
    useGloss: boolean;
    summary?: string;
  }) => {
    const systemPrompt = glossarySystemPrompt(
      glossaryPrompt,
      targetLang,
      useGloss && !!glossaryText,
    );
    const userPrompt = buildUserPrompt(DEFAULT_USER_PROMPT_STRUCTURE, targetLang, {
      useGlossary: useGloss,
      includeSummary: useSummary && !!summary,
    });
    const summaryUserPrompt = buildSummaryUserPrompt(
      DEFAULT_SUMMARY_USER_PROMPT,
      summary || "",
    );
    return { systemPrompt, userPrompt, summaryUserPrompt };
  };

  const stitchResult = (
    chunkStatuses: any[],
    warnings: string[],
    videoRef: string | null,
  ) => {
    const stitchedVtt = chunkStatuses.length
      ? runnerActions.stitchChunks(chunkStatuses)
      : "";
    const srt = stitchedVtt ? deriveSrt(stitchedVtt) : "";

    runnerActions.setResult({
      ok: warnings.length === 0 && chunkStatuses.every((c) => c.status === "ok"),
      warnings,
      chunks: chunkStatuses.sort((a, b) => a.idx - b.idx),
      vtt: stitchedVtt,
      srt,
      video_ref: videoRef,
    });
  };

  const normalizeVtt = (vttText: string) => {
    const repair = autoRepairVtt(vttText);
    const warnings: string[] = [];
    return { normalized: repair.repaired, warnings };
  };

  const normalizeVttTimecode = (code: string): string => {
    const cleaned = code.replace(",", ".");
    const parts = cleaned.split(":");
    let h = "00";
    let m = "00";
    let s = "00.000";
    if (parts.length === 2) {
      [m, s] = parts;
    } else if (parts.length === 3) {
      [h, m, s] = parts;
    }
    const [sec, ms] = s.split(".");
    const millis = (ms || "0").padEnd(3, "0").slice(0, 3);
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${sec.padStart(2, "0")}.${millis}`;
  };

  const normalizeVttForParse = (text: string): { cues: ReturnType<typeof parseVtt>; normalized: boolean } => {
    try {
      return { cues: parseVtt(text), normalized: false };
    } catch {
      const lines = text.split("\n").map((line) => {
        if (line.includes("-->")) {
          const [startRaw, endRaw] = line.split("-->").map((p) => p.trim());
          const start = normalizeVttTimecode(startRaw);
          const end = normalizeVttTimecode(endRaw.split(" ")[0]);
          return `${start} --> ${end}`;
        }
        return line;
      });
      return { cues: parseVtt(lines.join("\n")), normalized: true };
    }
  };

  const tryParseVttFlexible = (text: string): {
    cues: ReturnType<typeof parseVtt> | null;
    warnings: string[];
  } => {
    const warnings: string[] = [];
    try {
      const { cues, normalized } = normalizeVttForParse(text);
      if (normalized) warnings.push("Normalized timecodes");
      return { cues, warnings };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to parse VTT";
      warnings.push(msg);
      return { cues: null, warnings };
    }
  };

  const parseSubtitleText = (text: string, fileName: string): { cues: Cue[]; warnings: string[] } => {
    let cues: Cue[] = [];
    const warnings: string[] = [];
    const lowerName = fileName.toLowerCase();
    try {
      if (lowerName.endsWith(".srt")) {
        cues = parseSrt(text);
      } else {
        try {
          cues = parseVtt(text);
        } catch {
          cues = parseSrt(text);
        }
      }
    } catch (err) {
      // Try flexible parse
      const parsed = tryParseVttFlexible(text);
      if (parsed.cues) {
        cues = parsed.cues;
        warnings.push(...parsed.warnings);
      } else {
        throw err instanceof Error ? err : new Error("Invalid VTT or SRT file");
      }
    }
    return { cues, warnings };
  };

  const runTranslation = async (opts: {
    cues: Cue[];
    chunkSeconds: number;
    chunkOverlap: number;
    provider: ProviderType;
    apiKey: string;
    modelName: string;
    baseUrl?: string;
    targetLang: string;
    glossary: string;
    useGlossary: boolean;
    customPrompt: string;
    concurrency: number;
    temperature: number;
    useSummary: boolean;
    summaryText: string;
    videoRef: string | null;
    safetyOff: boolean;
  }) => {
    await runnerActions.runTranslation(opts);
  };

  const retryTranslationChunk = async (opts: {
    chunk: ChunkStatus;
    provider: ProviderType;
    apiKey: string;
    modelName: string;
    baseUrl?: string;
    targetLang: string;
    glossary: string;
    useGlossary: boolean;
    customPrompt: string;
    temperature: number;
    useSummary: boolean;
    summaryText: string;
    safetyOff: boolean;
    concurrency: number;
    runToken?: number;
  }) => {
    await runnerActions.retryChunk(opts);
  };

  const generateGlossary = async ({
    vttFile,
    resolvedProvider,
    safetyOff,
    setGlossary,
    setUseGlossary,
  }: {
    vttFile: File;
    resolvedProvider: {
      mismatch: boolean;
      selectedLabel: string;
      providerLabel: string;
      providerType: ProviderType;
      apiKeyForProvider?: string;
      modelForProvider: string;
      baseUrlForProvider?: string;
    };
    safetyOff: boolean;
    setGlossary: (text: string) => void;
    setUseGlossary: (use: boolean) => void;
  }) => {
    if (resolvedProvider.mismatch) {
      throw new Error(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model.`,
      );
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      throw new Error(`${resolvedProvider.providerLabel} API key required to generate glossary`);
    }
    const fileText = await vttFile.text();
    let cues: ReturnType<typeof parseVtt>;
    try {
      cues = vttFile.name.toLowerCase().endsWith(".srt")
        ? parseSrt(fileText)
        : parseVtt(fileText);
    } catch {
      cues = parseSrt(fileText);
    }
    const rawText = cues.map((c) => `${c.text}`).join("\n");
    const truncated = rawText.slice(0, 8000);
    const systemPrompt = glossarySystemPrompt(glossaryPrompt, targetLang);
    const userPrompt =
      "Generate a glossary for these subtitles. Output ONLY CSV lines: source,target. Focus on recurring names/terms that should stay consistent. Text follows:\n\n" +
      truncated;
    const { providerType, modelForProvider, apiKeyForProvider, baseUrlForProvider } = resolvedProvider;

    const config = {
      apiKey: providerType !== "ollama" ? apiKeyForProvider : undefined,
      modelName: modelForProvider,
      baseUrl: baseUrlForProvider,
    };

    const provider = ProviderFactory.create(providerType, config);
    const request = {
      systemPrompt,
      userPrompt,
      temperature: DEFAULT_TEMPERATURE,
      safetyOff,
    };
    const trace = { purpose: "glossary" };
    const generated = await provider.generateContent(request, trace);
    const text = generated.text.trim();
    setGlossary(text);
    setUseGlossary(!!text);
  };

  const generateSummary = async ({
    workflowMode,
    resolvedProvider,
    safetyOff,
    mediaFile,
    videoRef,
    vttFile,
    transcriptionText,
    useTranscriptionForSummary,
  }: {
    workflowMode: "translation" | "transcription";
    resolvedProvider: {
      mismatch: boolean;
      selectedLabel: string;
      providerLabel: string;
      providerType: ProviderType;
      apiKeyForProvider?: string;
      modelForProvider: string;
      baseUrlForProvider?: string;
    };
    safetyOff: boolean;
    mediaFile: File | null;
    videoRef: string | null;
    vttFile: File | null;
    transcriptionText: string;
    useTranscriptionForSummary: boolean;
  }) => {
    if (workflowMode === "transcription") {
      throw new Error("Switch to translation mode to generate summaries");
    }
    if (resolvedProvider.mismatch) {
      throw new Error(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model.`,
      );
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      throw new Error(`${resolvedProvider.providerLabel} API key required to generate summary`);
    }
    const isMediaSummary = !!mediaFile;
    const hasTextTranscript =
      useTranscriptionForSummary && Boolean(transcriptionText.trim());
    if (isMediaSummary && !videoRef) {
      throw new Error("Upload media first to generate a summary from media");
    }
    if (!isMediaSummary && !vttFile && !hasTextTranscript) {
      throw new Error(
        "Load subtitles or generate a transcription first to summarize",
      );
    }

    const fileLabel = isMediaSummary
      ? DEFAULT_SUMMARY_FILE_LABELS.media
      : DEFAULT_SUMMARY_FILE_LABELS.transcript;
    const systemPrompt = summarySystemPrompt(
      summaryPrompt,
      targetLang,
      fileLabel,
    );
    const template = isMediaSummary
      ? DEFAULT_SUMMARY_USER_PROMPT.media
      : DEFAULT_SUMMARY_USER_PROMPT.subtitles;
    let transcriptText: string | undefined;
    if (!isMediaSummary && vttFile) {
      const fileText = await vttFile.text();
      let cues: ReturnType<typeof parseVtt>;
      const lowerName = vttFile.name.toLowerCase();
      try {
        if (lowerName.endsWith(".srt")) {
          cues = parseSrt(fileText);
        } else {
          try {
            cues = parseVtt(fileText);
          } catch {
            cues = parseSrt(fileText);
          }
        }
      } catch {
        throw new Error("Unable to parse subtitles for summary");
      }
      const rawText = cues.map((cue) => cue.text).join("\n");
      transcriptText = rawText.slice(0, 8000);
    } else if (!isMediaSummary && hasTextTranscript) {
      transcriptText = transcriptionText.trim().slice(0, 8000);
    }
    const glossaryBlock =
      useGlossaryInSummary && glossary.trim()
        ? `${DEFAULT_USER_PROMPT_STRUCTURE.glossaryHeader}\n${glossary.trim()}\n\n`
        : "";
    const userPrompt = buildSummaryUserPrompt(template, targetLang, {
      glossary: glossaryBlock,
      text: transcriptText,
    });
    const { providerType, modelForProvider, apiKeyForProvider, baseUrlForProvider } = resolvedProvider;

    const config = {
      apiKey: providerType !== "ollama" ? apiKeyForProvider : undefined,
      modelName: modelForProvider,
      baseUrl: baseUrlForProvider,
    };

    const provider = ProviderFactory.create(providerType, config);
    const request: GenerateRequest = {
      systemPrompt,
      userPrompt,
      temperature: DEFAULT_TEMPERATURE,
      safetyOff,
      mediaUri: (isMediaSummary && provider.capabilities.supportsMediaUpload && videoRef) ? videoRef : undefined,
    };

    const trace = { purpose: isMediaSummary ? "summary" : "summary-subtitles" };
    const summary = await provider.generateContent(request, trace);
    const text = summary.text.trim();
    setSummaryText(text);
    setUseSummary(!!text);
  };

  const applyPreset = (presetId: PromptPresetId) => {
    const preset = PROMPT_PRESETS[presetId];
    if (!preset) return;
    setCustomPrompt(preset.systemText);
    setSummaryPrompt(preset.summary);
    setGlossaryPrompt(preset.glossary);
    setCurrentPreset(presetId);
  };

  const applyCustomPreset = (preset: CustomPreset) => {
    setCustomPrompt(preset.systemText);
    setSummaryPrompt(preset.summary);
    setGlossaryPrompt(preset.glossary);
    setCurrentPreset(preset.id as PromptPresetId);
  };

  const exportCurrentAsPreset = (name: string, description?: string) => {
    const id = `custom-${Date.now()}`;
    const preset = createPresetFromCurrent(
      id,
      name,
      customPrompt,
      customPrompt,
      customPrompt,
      summaryPrompt,
      glossaryPrompt,
      description,
    );
    downloadPresetFile(
      [preset],
      `${name.toLowerCase().replace(/\s+/g, "-")}.json`,
    );
  };

  const importPresetsFromJson = (jsonString: string) => {
    try {
      const imported = importPresets(jsonString);
      setCustomPresets((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPresets = imported.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPresets];
      });
      return { success: true, count: imported.length };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Import failed",
      };
    }
  };

  const deleteCustomPreset = (id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    if (currentPreset === id) {
      setCurrentPreset("general");
    }
  };

  const exportAllCustomPresets = () => {
    if (customPresets.length === 0) return;
    downloadPresetFile(customPresets, "chigyusubs-custom-presets.json");
  };

  const clearCustomPresets = () => {
    setCustomPresets([]);
    setCurrentPreset("general");
    try {
      window.localStorage.removeItem("customPresets");
    } catch {
      // ignore storage errors
    }
  };

  const allPresets = useMemo(() => {
    const builtIn = Object.entries(PROMPT_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
      isBuiltIn: true,
    }));
    const custom = customPresets.map((p) => ({
      id: p.id,
      name: p.name,
      isBuiltIn: false,
    }));
    return [...builtIn, ...custom];
  }, [customPresets]);

  return {
    state: {
      runnerState,
      targetLang,
      concurrency,
      chunkSeconds,
      chunkOverlap,
      customPrompt,
      glossary,
      useGlossary,
      temperature,
      summaryText,
      summaryStatus,
      summaryError,
      glossaryStatus,
      glossaryError,
      summaryPrompt,
      useSummary,
      glossaryPrompt,
      currentPreset,
      useGlossaryInSummary,
      promptPreview,
      customPresets,
      allPresets,
    },
    actions: {
      setTargetLang,
      setConcurrency: (v: number) => setConcurrency(clampedConcurrency(v)),
      setChunkSeconds,
      setChunkOverlap,
      setCustomPrompt,
      setGlossary,
      setUseGlossary,
      setTemperature,
      setSummaryText,
      setSummaryStatus,
      setSummaryError,
      setGlossaryStatus,
      setGlossaryError,
      setSummaryPrompt,
      setUseSummary,
      setGlossaryPrompt,
      setCurrentPreset,
      setUseGlossaryInSummary,
      setPromptPreview,
      normalizeCustomPrompt,
      applyPreset,
      applyCustomPreset,
      exportCurrentAsPreset,
      importPresetsFromJson,
      deleteCustomPreset,
      exportAllCustomPresets,
      clearCustomPresets,
    buildPrompts,
    stitchResult,
    normalizeVtt,
    parseSubtitleText,
    runTranslation,
    retryTranslationChunk,
    runnerActions,
    generateGlossary,
    generateSummary,
  },
  };
}
