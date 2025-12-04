import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_CHUNK_SECONDS,
  DEFAULT_CONCURRENCY,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_MODEL,
  DEFAULT_MODELS,
  DEFAULT_OVERLAP_CUES,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
  DEFAULT_SUMMARY_FILE_LABELS,
  DEFAULT_TARGET_LANG,
  DEFAULT_TEMPERATURE,
  DEFAULT_USE_AUDIO_ONLY,
  DEFAULT_USE_GLOSSARY,
  DEFAULT_USE_SUMMARY,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_USER_PROMPT_STRUCTURE,
  MAX_CONCURRENCY,
  PROMPT_PRESETS,
  TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
  TRANSCRIPTION_DEFAULT_CONCURRENCY,
  TRANSCRIPTION_MAX_CONCURRENCY,
  TRANSCRIPTION_MIN_CHUNK_SECONDS,
  TRANSCRIPTION_MIN_CONCURRENCY,
  DEFAULT_WORKFLOW_MODE,
  type WorkflowMode,
  type PromptPresetId,
} from "../config/defaults";
import { parseModelName, ProviderFactory } from "../lib/providers/ProviderFactory";
import type { ProviderType, GenerateRequest } from "../lib/providers/types";
import { getProviderCapability } from "../lib/providers/capabilities";
import { type ChunkStatus } from "../lib/translation";
import {
  buildSummaryUserPrompt,
  buildUserPrompt,
  glossarySystemPrompt,
  summarySystemPrompt,
} from "../lib/prompts";
import { parseSrt, parseVtt, serializeVtt } from "../lib/vtt";
import { useTranslationRunner } from "./useTranslationRunner";
import { getMediaDuration } from "../lib/mediaDuration";
import { transcribeOpenAiMedia } from "../lib/transcription/openai";

import { clearPrefs, loadPrefs, savePrefs, type UserPrefs } from "../lib/prefs";
import {
  type CustomPreset,
  importPresets,
  downloadPresetFile,
  createPresetFromCurrent,
} from "../lib/presetImportExport";

export function useTranslationWorkflowRunner() {
  const saved = loadPrefs();
  const mediaProbeIdRef = useRef(0);

  // Provider state
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(
    saved?.selectedProvider ?? "gemini"
  );
  const [apiKeys, setApiKeys] = useState<Record<ProviderType, string>>(() => {
    const defaultKeys: Record<ProviderType, string> = {
      gemini: "",
      openai: "",
      anthropic: "",
      ollama: "",
    };
    if (saved?.providerConfigs) {
      Object.entries(saved.providerConfigs).forEach(([provider, config]) => {
        if (config.apiKey) {
          defaultKeys[provider as ProviderType] = config.apiKey;
        }
      });
    }
    return defaultKeys;
  });
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    saved?.providerConfigs?.ollama?.baseUrl ?? "http://localhost:11434"
  );

  // File state
  const [vttFile, setVttFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [useAudioOnly, setUseAudioOnly] = useState(
    saved?.useAudioOnly ?? DEFAULT_USE_AUDIO_ONLY,
  );
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
  const [models, setModels] = useState<string[]>(
    saved?.models && saved.models.length ? saved.models : DEFAULT_MODELS,
  );
  const [modelName, setModelName] = useState(saved?.modelName ?? DEFAULT_MODEL);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(
    saved?.workflowMode ?? DEFAULT_WORKFLOW_MODE,
  );
  const [customPrompt, setCustomPrompt] = useState(
    saved?.customPrompt ?? DEFAULT_SYSTEM_PROMPT_TEXT,
  );
  const [glossary, setGlossary] = useState(saved?.glossary ?? "");
  const [useGlossary, setUseGlossary] = useState(
    saved?.useGlossary ?? DEFAULT_USE_GLOSSARY,
  );

  // Current API key (derived from selected provider)
  const apiKey = apiKeys[selectedProvider];
  const setApiKey = (provider: ProviderType, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }));
  };

  // Video/media state
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [videoFileId, setVideoFileId] = useState<string | null>(null);
  const [contextMediaKind, setContextMediaKind] = useState<
    "audio" | "video" | null
  >(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoSizeMb, setVideoSizeMb] = useState<number | null>(null);
  const [videoUploadState, setVideoUploadState] = useState<
    "idle" | "uploading" | "ready" | "error"
  >("idle");
  const [videoUploadMessage, setVideoUploadMessage] = useState("");
  const [mediaTooLargeWarning, setMediaTooLargeWarning] = useState(false);
  const [temperature, setTemperature] = useState(
    saved?.temperature ?? DEFAULT_TEMPERATURE,
  );
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
  const [safetyOff, setSafetyOff] = useState(saved?.safetyOff ?? false);
  const [mediaResolution, setMediaResolution] = useState<"low" | "standard">(
    saved?.mediaResolution ?? "low",
  );
  const [currentPreset, setCurrentPreset] = useState<PromptPresetId | "">(
    "general",
  );
  const [useGlossaryInSummary, setUseGlossaryInSummary] = useState(
    saved?.useGlossaryInSummary ?? false,
  );

  // Custom presets stored in localStorage
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      const stored = window.localStorage.getItem("customPresets");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Provider-specific configurations
  const [providerConfigs, setProviderConfigs] = useState<{
    openai: {
      transcriptionEnabled: boolean;
      transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
      transcriptionLanguage?: string;
      transcriptionConcurrency?: number;
      transcriptionChunkSeconds?: number;
    };
  }>(() => {
    const defaultConfig = {
      openai: {
        transcriptionEnabled: false,
        transcriptionModel: "gpt-4o-mini-transcribe" as const,
        transcriptionLanguage: "",
        transcriptionConcurrency: TRANSCRIPTION_DEFAULT_CONCURRENCY,
        transcriptionChunkSeconds: TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
      },
    };
    // Try to load from saved prefs
    if (saved?.providerSpecificConfigs?.openai) {
      return {
        openai: { ...defaultConfig.openai, ...saved.providerSpecificConfigs.openai },
      };
    }
    return defaultConfig;
  });

  // Audio transcription state (for OpenAI)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [useTranscription, setUseTranscription] = useState(false);
  const [useTranscriptionForSummary, setUseTranscriptionForSummary] = useState(
    saved?.useTranscriptionForSummary ?? false,
  );

  const providerLabels: Record<ProviderType, string> = {
    gemini: getProviderCapability("gemini").label,
    openai: getProviderCapability("openai").label,
    anthropic: getProviderCapability("anthropic").label,
    ollama: getProviderCapability("ollama").label,
  };

  const resolveProviderConfig = () => {
    const parsed = parseModelName(modelName);
    const providerType = parsed.provider;
    return {
      providerType,
      providerLabel: providerLabels[providerType],
      selectedLabel: providerLabels[selectedProvider],
      mismatch: providerType !== selectedProvider,
      modelForProvider: parsed.model,
      apiKeyForProvider: apiKeys[providerType] ?? "",
      baseUrlForProvider:
        providerType === "ollama" ? ollamaBaseUrl : undefined,
    };
  };

  const { state: runnerState, actions: runnerActions } = useTranslationRunner();

  // Save custom presets to localStorage whenever they change
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

  const clampConcurrency = (value: number) =>
    Math.min(MAX_CONCURRENCY, Math.max(1, value));
  const setConcurrencyClamped = (value: number) =>
    setConcurrency(clampConcurrency(value));
  const normalizeCustomPrompt = (value: string) => {
    const trimmed = value.trim();
    return trimmed && trimmed === DEFAULT_SYSTEM_PROMPT_TEXT.trim()
      ? ""
      : trimmed;
  };

  useEffect(() => {
    const providerConfigs: Record<ProviderType, import("../lib/prefs").ProviderConfig> = {
      gemini: { apiKey: apiKeys.gemini },
      openai: { apiKey: apiKeys.openai },
      anthropic: { apiKey: apiKeys.anthropic },
      ollama: { apiKey: apiKeys.ollama, baseUrl: ollamaBaseUrl },
    };
    const prefs: UserPrefs = {
      selectedProvider,
      providerConfigs,
      providerSpecificConfigs: providerConfigs as any, // Cast to match UserPrefs type
      modelName,
      models,
      workflowMode,
      mediaResolution,
      useAudioOnly,
      targetLang,
      chunkSeconds,
      chunkOverlap,
      concurrency,
      temperature,
      customPrompt,
      glossary,
      summaryText,
      summaryPrompt,
      glossaryPrompt,
      useSummary,
      useGlossary,
      safetyOff,
      useGlossaryInSummary,
      useTranscriptionForSummary,
    };
    savePrefs(prefs);
  }, [
    selectedProvider,
    apiKeys,
    ollamaBaseUrl,
    providerConfigs, // Added dependency
    modelName,
    workflowMode,
    models,
    workflowMode,
    mediaResolution,
    useAudioOnly,
    targetLang,
    chunkSeconds,
    chunkOverlap,
    concurrency,
    temperature,
    customPrompt,
    glossary,
    summaryText,
    summaryPrompt,
    glossaryPrompt,
    useSummary,
    useGlossary,
    safetyOff,
    useGlossaryInSummary,
    useTranscriptionForSummary,
  ]);

  const handleMediaChange = async (file: File | null) => {
    const probeId = ++mediaProbeIdRef.current;
    const maxUploadBytes = 2 * 1024 * 1024 * 1024; // 2GB limit for Gemini File API and ffmpeg wasm practicality
    if (file && file.size > maxUploadBytes) {
      setMediaFile(null);
      setVideoUploadState("error");
      setVideoUploadMessage(
        "File exceeds 2GB limit (Gemini File API + in-browser processing). Please trim or compress.",
      );
      setVideoName(null);
      setVideoFileId(null);
      setVideoDuration(null);
      setVideoSizeMb(null);
      setMediaTooLargeWarning(true);
      setUseSummary(false);
      setSummaryText("");
      setSummaryStatus("idle");
      setSummaryError("");
      return;
    }

    setMediaFile(file);
    setVideoRef(null);
    setVideoUploadState("idle");
    setVideoUploadMessage("");
    setMediaTooLargeWarning(false);
    setVideoName(null);
    setVideoFileId(null);
    setVideoDuration(null);
    setVideoSizeMb(null);
    setUseSummary(false);
    setSummaryText("");
    setSummaryStatus("idle");
    setSummaryError("");
    if (file) {
      setVideoSizeMb(file.size / (1024 * 1024));
      try {
        const duration = await getMediaDuration(file);
        if (mediaProbeIdRef.current === probeId) {
          setVideoDuration(
            duration && Number.isFinite(duration) ? duration : null,
          );
        }
      } catch (err) {
        setVideoUploadMessage(
          err instanceof Error ? err.message : "Unable to read video duration",
        );
      }
    }
  };

  const handleUploadVideo = async () => {
    if (!mediaFile) {
      setError("Select a context media file to upload");
      return;
    }
    if (selectedProvider !== "ollama" && !apiKey) {
      setError(`${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API key is required to upload video`);
      return;
    }
    setError("");
    setVideoUploadState("uploading");
    setVideoUploadMessage(`Uploading media to ${selectedProvider}…`);
    try {
      let mediaToUpload: File = mediaFile;
      const isAudio = mediaToUpload.type.startsWith("audio/");
      if (useAudioOnly && !isAudio) {
        const audio = await extractAudioToOggMono(mediaFile);
        mediaToUpload = audio;
        setVideoName(audio.name);
        setVideoSizeMb(audio.size / (1024 * 1024));
        const probeId = ++mediaProbeIdRef.current;
        const duration = await getMediaDuration(audio);
        if (mediaProbeIdRef.current === probeId) {
          setVideoDuration(
            duration && Number.isFinite(duration) ? duration : null,
          );
        }
      }
      // Create provider instance for media upload
      const config = {
        apiKey: selectedProvider !== "ollama" ? apiKey : undefined,
        modelName: modelName,
        baseUrl: selectedProvider === "ollama" ? ollamaBaseUrl : undefined,
      };

      const provider = ProviderFactory.create(selectedProvider, config);

      // Check if provider supports media upload
      if (!provider.uploadMedia) {
        throw new Error(`${selectedProvider} does not support media upload`);
      }

      const data = await provider.uploadMedia(mediaToUpload);
      setVideoRef(data.fileUri);
      setVideoName(
        (prev) => prev || data.fileName || mediaToUpload.name || null,
      );
      setVideoFileId(data.fileName || null);
      setContextMediaKind(useAudioOnly || isAudio ? "audio" : "video");
      setVideoUploadState("ready");
      setVideoUploadMessage("Media is uploaded, processed, and ready.");
      runnerActions.setProgress("");
      setUseSummary(false);
      setSummaryText("");
      setSummaryStatus("idle");
      setSummaryError("");
    } catch (err) {
      setVideoUploadState("error");
      setVideoUploadMessage(
        err instanceof Error ? err.message : "Unable to upload video",
      );
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoRef || !apiKey) {
      setError("No uploaded media to delete or missing API key");
      return;
    }
    const target =
      videoFileId ||
      (videoRef.includes("/files/") ? videoRef.split("/files/").pop() : null);
    if (!target) {
      setError("Could not determine uploaded media name to delete");
      return;
    }
    runnerActions.setProgress("Deleting uploaded video from Gemini…");
    setError("");
    try {
      // Create provider instance for media deletion
      const config = {
        apiKey: selectedProvider !== "ollama" ? apiKey : undefined,
        modelName: modelName,
        baseUrl: selectedProvider === "ollama" ? ollamaBaseUrl : undefined,
      };

      const provider = ProviderFactory.create(selectedProvider, config);

      // Check if provider supports media deletion
      if (!provider.deleteMedia) {
        throw new Error(`${selectedProvider} does not support media deletion`);
      }

      await provider.deleteMedia(target);
      setVideoRef(null);
      setVideoName(null);
      setVideoFileId(null);
      setContextMediaKind(null);
      setVideoUploadState("idle");
      setVideoUploadMessage("Deleted from provider");
      runnerActions.setProgress("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete uploaded media",
      );
      runnerActions.setProgress("");
    }
  };

  const handleLoadModels = async () => {
    // Ollama doesn't require an API key
    if (selectedProvider !== "ollama" && !apiKey) {
      setError(`${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API key is required to load models`);
      return;
    }
    setError("");
    runnerActions.setProgress("Loading models…");
    try {
      const { ProviderFactory } = await import("../lib/providers");
      const config: import("../lib/providers/types").ProviderConfig = {
        apiKey,
        modelName: "", // Not needed for listing models
      };
      if (selectedProvider === "ollama") {
        config.baseUrl = ollamaBaseUrl;
      }
      const provider = ProviderFactory.create(selectedProvider, config);
      const modelList = await provider.listModels();
      // Always prefix model names with their provider to ensure correct routing
      const names = modelList.map(m => `${m.provider}/${m.displayName}`);
      if (names.length > 0) {
        setModels(names);
        setModelName(names[0]);
      } else {
        setError("No models available from provider");
      }
      runnerActions.setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load models");
      runnerActions.setProgress("");
    }
  };

  const handleGenerateGlossary = async () => {
    if (!vttFile) {
      setGlossaryError("Load subtitles first to generate glossary");
      return;
    }
    const resolvedProvider = resolveProviderConfig();
    if (resolvedProvider.mismatch) {
      setGlossaryStatus("idle");
      setGlossaryError(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model.`,
      );
      return;
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      setGlossaryStatus("idle");
      setGlossaryError(`${resolvedProvider.providerLabel} API key required to generate glossary`);
      return;
    }
    setGlossaryStatus("loading");
    try {
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

      // Create provider instance
      const config = {
        apiKey: providerType !== "ollama" ? apiKeyForProvider : undefined,
        modelName: modelForProvider,
        baseUrl: baseUrlForProvider,
      };

      const provider = ProviderFactory.create(providerType, config);

      // Prepare the request
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
      setGlossaryError("");
    } catch (err) {
      setGlossaryError(
        err instanceof Error ? err.message : "Failed to generate glossary",
      );
    } finally {
      setGlossaryStatus("idle");
    }
  };

  const handleGenerateSummary = async () => {
    if (workflowMode === "transcription") {
      setSummaryError("Switch to translation mode to generate summaries");
      return;
    }
    const resolvedProvider = resolveProviderConfig();
    if (resolvedProvider.mismatch) {
      setSummaryError(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model.`,
      );
      return;
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      setSummaryError(`${resolvedProvider.providerLabel} API key required to generate summary`);
      return;
    }
    const isMediaSummary = !!mediaFile;
    const hasTextTranscript =
      useTranscriptionForSummary && Boolean(transcriptionText.trim());
    if (isMediaSummary && !videoRef) {
      setSummaryError("Upload media first to generate a summary from media");
      return;
    }
    if (!isMediaSummary && !vttFile && !hasTextTranscript) {
      setSummaryError(
        "Load subtitles or generate a transcription first to summarize",
      );
      return;
    }

    setSummaryError("");
    setSummaryStatus("loading");
    try {
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
      // Determine provider from model name (parseModelName handles defaulting to gemini)
      const { providerType, modelForProvider, apiKeyForProvider, baseUrlForProvider } = resolvedProvider;

      // Create provider instance
      const config = {
        apiKey: providerType !== "ollama" ? apiKeyForProvider : undefined,
        modelName: modelForProvider,
        baseUrl: baseUrlForProvider,
      };

      const provider = ProviderFactory.create(providerType, config);

      // Prepare the request - including mediaUri if supported
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
      setSummaryStatus("ready");
      setSummaryError("");
    } catch (err) {
      setSummaryStatus("error");
      setSummaryError(
        err instanceof Error ? err.message : "Summary generation failed",
      );
    }
  };

  const updateProviderConfig = (
    provider: "openai",
    config: typeof providerConfigs.openai
  ) => {
    setProviderConfigs((prev) => ({
      ...prev,
      [provider]: config,
    }));
  };

  const handleTranscribeAudio = async () => {
    if (!audioFile) return;

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper API limit
    const clampChunkSeconds = (val: number | undefined) =>
      Math.max(
        TRANSCRIPTION_MIN_CHUNK_SECONDS,
        val ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
      );
    const maxSegmentSeconds = clampChunkSeconds(
      providerConfigs.openai.transcriptionChunkSeconds,
    ); // Keep well under GPT-4o-transcribe comfort zone while allowing Whisper flexibility

    try {
      setTranscriptionStatus("loading");
      setError("");
      setStatusMessage("");

      // Create provider instance
      const provider = ProviderFactory.create("openai", {
        apiKey: apiKeys.openai,
        modelName: "whisper-1", // Model name doesn't matter for transcription endpoint but required by type
      }) as import("../lib/providers/OpenAIProvider").OpenAIProvider;

      if (!provider.transcribeAudio) {
        throw new Error("Provider does not support transcription");
      }

      const model = providerConfigs.openai.transcriptionModel || "gpt-4o-mini-transcribe";

      const transcriptionConcurrency = Math.min(
        TRANSCRIPTION_MAX_CONCURRENCY,
        Math.max(
          TRANSCRIPTION_MIN_CONCURRENCY,
          providerConfigs.openai.transcriptionConcurrency ?? TRANSCRIPTION_DEFAULT_CONCURRENCY,
        ),
      );
      const result = await transcribeOpenAiMedia({
        file: audioFile,
        provider,
        model,
        language: providerConfigs.openai.transcriptionLanguage || undefined,
        chunkSeconds: maxSegmentSeconds,
        concurrency: transcriptionConcurrency,
        maxFileSizeBytes: MAX_FILE_SIZE,
        onStatus: setStatusMessage,
      });

      setTranscriptionText(result.text);
      if (result.isVtt) {
        setUseTranscription(true);
      } else {
        setUseTranscription(false); // Text-only result
        setUseTranscriptionForSummary(true);
      }

      setError(""); // Clear progress messages on success
      setStatusMessage("");
      setTranscriptionStatus("success");
    } catch (err) {
      setTranscriptionStatus("error");
      const errorMsg =
        err instanceof Error ? err.message : "Transcription failed";
      setStatusMessage("");
      setError(`Transcription failed: ${errorMsg}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStatusMessage("");
    runnerActions.setResult(null);
    runnerActions.setProgress("");

    // Validate input: Need either VTT file OR enabled transcription
    const hasVttFile = Boolean(vttFile);
    const hasTranscription = Boolean(useTranscription && transcriptionText);
    if (workflowMode === "transcription" && selectedProvider !== "gemini") {
      setError("Transcription mode requires the Gemini provider");
      return;
    }
    if (workflowMode === "transcription" && !mediaFile) {
      setError("Upload media to transcribe");
      return;
    }
    if (workflowMode === "transcription" && !apiKey) {
      setError("Gemini API key is required for transcription");
      return;
    }

    if (!hasVttFile && !hasTranscription) {
      setError("Please provide either a subtitle file or generate a transcription");
      return;
    }

    const resolvedProvider = resolveProviderConfig();
    if (resolvedProvider.mismatch) {
      setError(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model.`,
      );
      return;
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      setError(`${resolvedProvider.providerLabel} API key is required`);
      return;
    }

    setSubmitting(true);
    runnerActions.setProgress("Reading subtitles…");

    let vttText = "";
    let fileNameForParsing = "transcription.vtt";

    try {
      if (useTranscription && transcriptionText) {
        vttText = transcriptionText;
      } else if (vttFile) {
        vttText = await vttFile.text();
        fileNameForParsing = vttFile.name;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read VTT file");
      setSubmitting(false);
      return;
    }

    let cues: ReturnType<typeof parseVtt>;
    const lowerName = fileNameForParsing.toLowerCase();
    try {
      if (lowerName.endsWith(".srt")) {
        cues = parseSrt(vttText);
      } else {
        try {
          cues = parseVtt(vttText);
        } catch {
          cues = parseSrt(vttText);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid VTT or SRT file");
      setSubmitting(false);
      return;
    }

    const activeVideoRef = videoRef;
    const combinedPrompt = normalizeCustomPrompt(customPrompt);
    try {
      const data = await runnerActions.runTranslation({
        cues,
        chunkSeconds,
        chunkOverlap,
        provider: resolvedProvider.providerType,
        apiKey: resolvedProvider.apiKeyForProvider,
        modelName: resolvedProvider.modelForProvider,
        targetLang,
        glossary,
        useGlossary,
        customPrompt: combinedPrompt,
        concurrency,
        temperature,
        useSummary,
        summaryText,
        videoRef: activeVideoRef,
        safetyOff,
        baseUrl: resolvedProvider.baseUrlForProvider,
      });
      if (!data) {
        setSubmitting(false);
        return;
      }
      if (activeVideoRef) {
        setVideoUploadState("ready");
        setVideoUploadMessage("Video already uploaded and ready for retries.");
      }
      runnerActions.setProgress("Stitching complete");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error during translation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryChunk = async (chunk: ChunkStatus) => {
    const resolvedProvider = resolveProviderConfig();
    if (!runnerState.result) {
      setError("No translation run found to retry");
      return;
    }
    if (resolvedProvider.mismatch) {
      setError(
        `Selected provider (${resolvedProvider.selectedLabel}) does not match the model's provider (${resolvedProvider.providerLabel}). Refresh and choose a ${resolvedProvider.selectedLabel} model before retrying.`,
      );
      return;
    }
    if (resolvedProvider.providerType !== "ollama" && !resolvedProvider.apiKeyForProvider) {
      setError(`${resolvedProvider.providerLabel} API key required to retry`);
      return;
    }
    if (!chunk.chunk_vtt) {
      setError("No chunk payload available to retry");
      return;
    }
    runnerActions
      .retryChunk({
        chunk,
        provider: resolvedProvider.providerType,
        apiKey: resolvedProvider.apiKeyForProvider,
        modelName: resolvedProvider.modelForProvider,
        targetLang,
        glossary,
        useGlossary,
        customPrompt: normalizeCustomPrompt(customPrompt) || "",
        temperature,
        useSummary,
        summaryText,
        safetyOff,
        concurrency,
        baseUrl: resolvedProvider.baseUrlForProvider,
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Retry error"),
      );
  };

  const handleManualChunkEdit = (chunkIdx: number, vttContent: string) => {
    const validateCueIntegrity = (cues: ReturnType<typeof parseVtt>): string | null => {
      for (let i = 0; i < cues.length; i += 1) {
        const cue = cues[i];
        if (cue.end <= cue.start) {
          return `Cue ${i + 1} ends before it starts`;
        }
        if (i > 0 && cue.start < cues[i - 1].end) {
          return `Cue ${i + 1} overlaps the previous cue`;
        }
      }
      return null;
    };

    // Validate the VTT content before setting it
    try {
      // Attempt to parse the VTT to ensure it's valid
      const cues = parseVtt(vttContent);
      const integrityError = validateCueIntegrity(cues);
      if (integrityError) {
        setError(`Invalid VTT format: ${integrityError}`);
        return;
      }
      // If successful, set the manual override
      runnerActions.setManualChunkStatus(chunkIdx, vttContent, ["Manually corrected by user"]);
    } catch (err) {
      setError(`Invalid VTT format: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const resetWorkflow = () => {
    // Reset run state only; keep user-configured options and text fields.
    setError("");
    setSubmitting(false);
    runnerActions.reset();
  };

  const clearPreferences = () => {
    // Reset non-sensitive preferences to defaults; keep files and API key intact.
    setModels(DEFAULT_MODELS);
    setModelName(DEFAULT_MODEL);
    setMediaResolution("low");
    setUseAudioOnly(DEFAULT_USE_AUDIO_ONLY);
    setTargetLang(DEFAULT_TARGET_LANG);
    setChunkSeconds(DEFAULT_CHUNK_SECONDS);
    setChunkOverlap(DEFAULT_OVERLAP_CUES);
    setConcurrencyClamped(DEFAULT_CONCURRENCY);
    setTemperature(DEFAULT_TEMPERATURE);
    setCustomPrompt(DEFAULT_SYSTEM_PROMPT_TEXT);
    // Keep user-entered summary/glossary content
    setSummaryPrompt(DEFAULT_SUMMARY_PROMPT);
    setGlossaryPrompt(DEFAULT_GLOSSARY_PROMPT);
    setUseSummary(DEFAULT_USE_SUMMARY);
    setUseGlossary(DEFAULT_USE_GLOSSARY);
    setUseGlossaryInSummary(false);
    setSafetyOff(false);
    try {
      clearPrefs();
      window.localStorage.removeItem("theme");
    } catch {
      // ignore storage errors
    }
  };

  const promptPreview = useMemo(() => {
    return buildUserPrompt(
      targetLang,
      glossary,
      chunkOverlap > 0 ? "(Previous chunk context will appear here...)" : "",
      "(Subtitle cues to translate will appear here...)",
      useSummary && summaryText ? summaryText : undefined,
      useGlossary,
    );
  }, [
    targetLang,
    glossary,
    useSummary,
    summaryText,
    useGlossary,
    chunkOverlap,
  ]);

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
      customPrompt, // Using same for video (could be enhanced later)
      customPrompt, // Using same for audio (could be enhanced later)
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
        // Merge, avoiding duplicates by ID
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

  // Merge built-in and custom presets for display
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
      // Provider state
      selectedProvider,
      apiKeys,
      ollamaBaseUrl,
      // Files
      vttFile,
      mediaFile,
      useAudioOnly,
      targetLang,
      concurrency,
      chunkSeconds,
      chunkOverlap,
      models,
      modelName,
      workflowMode,
      customPrompt,
      glossary,
      useGlossary,
      apiKey,
      videoName,
      videoRef,
      videoUploadState,
      videoUploadMessage,
      mediaTooLargeWarning,
      videoSizeMb,
      videoDuration,
      temperature,
      progress: runnerState.progress,
      result: runnerState.result,
      paused: runnerState.paused,
      isRunning: runnerState.isRunning,
      error,
      statusMessage,
      submitting,
      retryingChunks: runnerState.retryingChunks,
      retryQueueIds: runnerState.retryQueueIds,
      summaryText,
      summaryStatus,
      summaryError,
      glossaryStatus,
      glossaryError,
      summaryPrompt,
      useSummary,
      glossaryPrompt,
      promptPreview,
      safetyOff,
      mediaResolution,
      currentPreset,
      customPresets,
      allPresets,
      useGlossaryInSummary,
      workflowMode,
      // Transcription state
      providerConfigs,
      audioFile,
      transcriptionText,
      transcriptionStatus,
      useTranscription,
      useTranscriptionForSummary,
    },
    actions: {
      // Provider actions
      setSelectedProvider,
      setApiKey,
      setOllamaBaseUrl,
      updateProviderConfig, // New action
      // File actions
      setVttFile,
      setMediaFile: handleMediaChange,
      setAudioFile, // New action
      setTranscriptionText, // New action
      setUseTranscription, // New action
      setUseTranscriptionForSummary,
      handleTranscribeAudio, // New action
      handleManualChunkEdit,
      setUseAudioOnly,
      setTargetLang,
      setConcurrency: setConcurrencyClamped,
      setChunkSeconds,
      setChunkOverlap,
      setModelName,
      setCustomPrompt,
      setGlossary,
      setUseGlossary,
      setTemperature,
      handleSubmit,
      handleLoadModels,
      handleGenerateGlossary,
      handleGenerateSummary,
      handleRetryChunk,
      handleUploadVideo,
      handleDeleteVideo,
      resetWorkflow,
      clearPreferences,
      setSummaryText,
      setUseSummary,
      setGlossaryPrompt,
      setSummaryPrompt,
      setSafetyOff,
      setMediaResolution,
      setWorkflowMode,
      pause: runnerActions.pause,
      resume: runnerActions.resume,
      applyPreset,
      applyCustomPreset,
      exportCurrentAsPreset,
      importPresetsFromJson,
      deleteCustomPreset,
      exportAllCustomPresets,
      clearCustomPresets,
      setUseGlossaryInSummary,
    },
  };
}
