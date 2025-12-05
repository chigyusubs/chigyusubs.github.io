import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_CHUNK_SECONDS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MODEL,
  DEFAULT_MODELS,
  DEFAULT_OVERLAP_CUES,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  DEFAULT_TARGET_LANG,
  DEFAULT_TEMPERATURE,
  DEFAULT_USE_AUDIO_ONLY,
  DEFAULT_USE_GLOSSARY,
  DEFAULT_USE_SUMMARY,
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  MAX_CONCURRENCY,
  TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
  TRANSCRIPTION_DEFAULT_CONCURRENCY,
  TRANSCRIPTION_MAX_CONCURRENCY,
  TRANSCRIPTION_MIN_CHUNK_SECONDS,
  TRANSCRIPTION_MIN_CONCURRENCY,
  DEFAULT_TRANSCRIPTION_PROMPT,
  TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS,
  DEFAULT_WORKFLOW_MODE,
  type WorkflowMode,
} from "../config/defaults";
import { parseModelName, ProviderFactory } from "../lib/providers/ProviderFactory";
import type { ProviderType, GenerateRequest } from "../lib/providers/types";
import { getProviderCapability } from "../lib/providers/capabilities";
import { type ChunkStatus } from "../lib/translation";
import { parseVtt, serializeVtt } from "../lib/vtt";
import { useTranslationRunner } from "./useTranslationRunner";
import { getMediaDuration } from "../lib/mediaDuration";
import { extractAudioToOggMono } from "../lib/ffmpeg";
import {
  MAX_UPLOAD_BYTES,
  prepareMediaFile,
  uploadMediaToProvider,
} from "../lib/mediaUpload";
import { transcribeOpenAiMedia } from "../lib/transcription/openai";
import { useTranscription } from "../features/transcription/hooks/useTranscription";
import type { TranscriptionChunk } from "../features/transcription/types";
import { useProviderState } from "./useProviderState";
import { useTranslationWorkflow } from "../features/translation/hooks/useTranslationWorkflow";

import { clearPrefs, loadPrefs, savePrefs, type UserPrefs } from "../lib/prefs";

export function useTranslationWorkflowRunner() {
  const saved = loadPrefs();
  const mediaProbeIdRef = useRef(0);

  // Provider state (extracted)
  const {
    selectedProvider,
    setSelectedProvider,
    apiKeys,
    setApiKey,
    apiKey,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    models,
    setModels,
    modelName,
    setModelName,
    providerConfigs,
    updateProviderConfig,
  } = useProviderState(saved);
  // File state
  const [vttFile, setVttFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [useAudioOnly, setUseAudioOnly] = useState(
    saved?.useAudioOnly ?? DEFAULT_USE_AUDIO_ONLY,
  );
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(
    saved?.workflowMode ?? DEFAULT_WORKFLOW_MODE,
  );
  const [transcriptionPrompt, setTranscriptionPrompt] = useState(
    saved?.transcriptionPrompt ?? DEFAULT_TRANSCRIPTION_PROMPT,
  );
  const [transcriptionOverlapSeconds, setTranscriptionOverlapSeconds] = useState(
    saved?.transcriptionOverlapSeconds ?? TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS,
  );
  const [useInlineChunks, setUseInlineChunks] = useState(
    saved?.useInlineChunks ?? false,
  );
  const translationWorkflow = useTranslationWorkflow(saved);
  const tState = translationWorkflow.state;
  const tActions = translationWorkflow.actions;

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
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [safetyOff, setSafetyOff] = useState(saved?.safetyOff ?? false);
  const [mediaResolution, setMediaResolution] = useState<"low" | "standard">(
    saved?.mediaResolution ?? "low",
  );

  // Audio transcription state (for OpenAI)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [useTranscriptionEnabled, setUseTranscriptionEnabled] = useState(false);
  const [useTranscriptionForSummary, setUseTranscriptionForSummary] = useState(
    saved?.useTranscriptionForSummary ?? false,
  );

  const providerLabels: Record<ProviderType, string> = {
    gemini: getProviderCapability("gemini").label,
    openai: getProviderCapability("openai").label,
    anthropic: getProviderCapability("anthropic").label,
    ollama: getProviderCapability("ollama").label,
  };
  const transcriptionPausedRef = useRef(false);

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

  const normalizeVttTimecode = (code: string): string => {
    const cleaned = code.replace(",", ".");
    const parts = cleaned.split(":");
    let h = "00";
    let m = "00";
    let s = "00.000";
    if (parts.length === 2) {
      // mm:ss(.ms)
      [m, s] = parts;
    } else {
      // take last 3 parts as h:m:s
      const tail = parts.slice(-3);
      [h, m, s] = tail;
    }
    const [sec, msRaw = "000"] = s.split(".");
    const ms = `${msRaw}000`.slice(0, 3);
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${sec.padStart(2, "0")}.${ms}`;
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
  const transcriptionFeature = useTranscription();
  const transcriptionState = transcriptionFeature.state;
  const transcriptionActions = transcriptionFeature.actions;

  const setConcurrencyClamped = (value: number) =>
    tActions.setConcurrency(Math.min(MAX_CONCURRENCY, Math.max(1, value)));
  const normalizeCustomPrompt = tActions.normalizeCustomPrompt;

  const resumeTranscription = () => {
    transcriptionFeature.actions.resume();
    transcriptionPausedRef.current = false;
  };

  const pauseTranscription = () => {
    transcriptionFeature.actions.pause();
    transcriptionPausedRef.current = true;
  };

  const cancelTranscription = () => {
    transcriptionFeature.actions.cancel();
    transcriptionPausedRef.current = false;
    transcriptionFeature.actions.reset();
    setTranscriptionStatus("idle");
    setSubmitting(false);
    setError("");
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
      targetLang: tState.targetLang,
      chunkSeconds: tState.chunkSeconds,
      chunkOverlap: tState.chunkOverlap,
      concurrency: tState.concurrency,
      temperature: tState.temperature,
      customPrompt: tState.customPrompt,
      glossary: tState.glossary,
      summaryText: tState.summaryText,
      summaryPrompt: tState.summaryPrompt,
      glossaryPrompt: tState.glossaryPrompt,
      useSummary: tState.useSummary,
      useGlossary: tState.useGlossary,
      safetyOff,
      useGlossaryInSummary: tState.useGlossaryInSummary,
      useTranscriptionForSummary,
      transcriptionPrompt,
      transcriptionOverlapSeconds,
      useInlineChunks,
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
    tState.targetLang,
    tState.chunkSeconds,
    tState.chunkOverlap,
    tState.concurrency,
    tState.temperature,
    tState.customPrompt,
    tState.glossary,
    tState.summaryText,
    tState.summaryPrompt,
    tState.glossaryPrompt,
    tState.useSummary,
    tState.useGlossary,
    safetyOff,
    tState.useGlossaryInSummary,
    useTranscriptionForSummary,
    transcriptionPrompt,
    transcriptionOverlapSeconds,
    useInlineChunks,
  ]);

  const handleMediaChange = async (file: File | null) => {
    const probeId = ++mediaProbeIdRef.current;
    if (file && file.size > MAX_UPLOAD_BYTES) {
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
    if (!file) return;

    try {
      const duration = await getMediaDuration(file);
      if (mediaProbeIdRef.current === probeId) {
        setVideoDuration(
          duration && Number.isFinite(duration) ? duration : null,
        );
        setVideoSizeMb(file.size / (1024 * 1024));
      }
    } catch (err) {
      setVideoUploadMessage(
        err instanceof Error ? err.message : "Unable to read video duration",
      );
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
    if (selectedProvider === "gemini" && useInlineChunks) {
      setError("Inline mode selected; no upload needed.");
      return;
    }
    setError("");
    setVideoUploadState("uploading");
    setVideoUploadMessage(`Uploading media to ${selectedProvider}…`);
    try {
      const prepared = await prepareMediaFile(mediaFile, {
        useAudioOnly,
        getMediaDuration,
        extractAudioToOggMono,
      });

      const data = await uploadMediaToProvider(selectedProvider, {
        apiKey: selectedProvider !== "ollama" ? apiKey : undefined,
        modelName,
        baseUrl: selectedProvider === "ollama" ? ollamaBaseUrl : undefined,
        file: prepared.file,
      });
      setVideoRef(data.fileUri);
      setVideoName(
        (prev) => prev || data.fileName || prepared.name,
      );
      setVideoFileId(data.fileName || null);
      setContextMediaKind(prepared.isAudio ? "audio" : "video");
      setVideoUploadState("ready");
      setVideoUploadMessage("Media is uploaded, processed, and ready.");
      runnerActions.setProgress("");
      setUseSummary(false);
      setSummaryText("");
      setSummaryStatus("idle");
      setSummaryError("");
      setVideoSizeMb(prepared.sizeMb);
      setVideoDuration(prepared.duration);
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
      tActions.setGlossaryError("Load subtitles first to generate glossary");
      return;
    }
    tActions.setGlossaryStatus("loading");
    try {
      await tActions.generateGlossary({
        vttFile,
        resolvedProvider: resolveProviderConfig(),
        safetyOff,
        setGlossary: tActions.setGlossary,
        setUseGlossary: tActions.setUseGlossary,
      });
      tActions.setGlossaryError("");
    } catch (err) {
      tActions.setGlossaryError(
        err instanceof Error ? err.message : "Failed to generate glossary",
      );
    } finally {
      tActions.setGlossaryStatus("idle");
    }
  };

  const handleGenerateSummary = async () => {
    tActions.setSummaryError("");
    tActions.setSummaryStatus("loading");
    try {
      await tActions.generateSummary({
        workflowMode,
        resolvedProvider: resolveProviderConfig(),
        safetyOff,
        mediaFile,
        videoRef,
        vttFile,
        transcriptionText,
        useTranscriptionForSummary,
      });
      tActions.setSummaryStatus("ready");
      tActions.setSummaryError("");
    } catch (err) {
      tActions.setSummaryStatus("error");
      tActions.setSummaryError(
        err instanceof Error ? err.message : "Summary generation failed",
      );
    }
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

  const handleTranscription = async () => {
    let resolvedProvider = resolveProviderConfig();
    const isTranscriptionCapable = resolvedProvider.providerType === "gemini" || resolvedProvider.providerType === "openai";

    if (!isTranscriptionCapable) {
      setError(`Transcription mode requires Gemini or OpenAI provider (current: ${resolvedProvider.providerLabel})`);
      return;
    }

    // For OpenAI, we need videoFile; for Gemini we need videoRef
    if (resolvedProvider.providerType === "gemini" && !videoRef) {
      if (!(useInlineChunks && mediaFile)) {
        setError("Upload media to transcribe with Gemini");
        return;
      }
    }
    if (resolvedProvider.providerType === "openai" && !mediaFile) {
      setError("Select media file to transcribe with OpenAI");
      return;
    }
    if (!apiKey) {
      setError(`${resolvedProvider.providerLabel} API key is required for transcription`);
      return;
    }

    // Use new transcription feature
    const chunkLength = providerConfigs.openai.transcriptionChunkSeconds ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS;
    const overlapSeconds = Math.max(0, transcriptionOverlapSeconds ?? 0);
    const totalDuration = videoDuration && Number.isFinite(videoDuration) ? videoDuration : null;

    setSubmitting(true);
    transcriptionPausedRef.current = false;

    try {
      const baseConfig = {
        videoRef: videoRef ?? "",
        videoFile: mediaFile ?? undefined,
        apiKey: resolvedProvider.apiKeyForProvider,
        chunkLength,
        overlapSeconds,
        videoDuration: totalDuration,
      };

      if (resolvedProvider.providerType === "openai") {
        await transcriptionActions.start({
          ...baseConfig,
          provider: "openai",
          model: providerConfigs.openai.transcriptionModel ?? "gpt-4o-mini-transcribe",
          language: providerConfigs.openai.transcriptionLanguage,
          concurrency: providerConfigs.openai.transcriptionConcurrency ?? TRANSCRIPTION_DEFAULT_CONCURRENCY,
        });
      } else {
        await transcriptionActions.start({
          ...baseConfig,
          provider: "gemini",
          modelName: resolvedProvider.modelForProvider,
          useInlineChunks,
          prompt: transcriptionPrompt,
          temperature: DEFAULT_TEMPERATURE,
          safetyOff,
        });
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setSubmitting(false);
      transcriptionPausedRef.current = false;
    }
  };

  // OLD IMPLEMENTATION - removed

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStatusMessage("");
    runnerActions.setResult(null);
    runnerActions.setProgress("");

    // Validate input: Need either VTT file OR enabled transcription
    const hasVttFile = Boolean(vttFile);
    const hasTranscription = Boolean(useTranscriptionEnabled && transcriptionText);
    let resolvedProvider = resolveProviderConfig();
    const isTranscriptionCapable = resolvedProvider.providerType === "gemini" || resolvedProvider.providerType === "openai";

    if (workflowMode === "transcription" && !isTranscriptionCapable) {
      setError(`Transcription mode requires Gemini or OpenAI provider (current: ${resolvedProvider.providerLabel})`);
      return;
    }
    if (workflowMode === "transcription" && !mediaFile) {
      setError("Upload or select media to transcribe");
      return;
    }
    if (workflowMode === "transcription" && !apiKey) {
      setError(`${resolvedProvider.providerLabel} API key is required for transcription`);
      return;
    }
    if (workflowMode === "transcription") {
      await handleTranscription();
      return;
    }

    if (!hasVttFile && !hasTranscription) {
      setError("Please provide either a subtitle file or generate a transcription");
      return;
    }

    setSubmitting(true);
    runnerActions.setProgress("Reading subtitles…");

    let vttText = "";
    let fileNameForParsing = "transcription.vtt";

    try {
      if (useTranscriptionEnabled && transcriptionText) {
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

    try {
      const resolved = resolveProviderConfig();
      const activeVideoRef = videoRef;
      const warnings = await tActions.submitTranslationRun({
        vttText,
        fileNameForParsing,
        videoRef: activeVideoRef,
        resolvedProvider: resolved,
        safetyOff,
        onStatus: setStatusMessage,
      });
      if (warnings.length) {
        setStatusMessage(warnings.join(", "));
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
    try {
      const resolvedProvider = resolveProviderConfig();
      await tActions.scheduleRetry({
        chunk,
        resolvedProvider,
        safetyOff,
        concurrency: tState.concurrency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry error");
    }
  };

  const handleManualChunkEdit = (chunkIdx: number, vttContent: string) => {
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

  const handleRetryTranscriptionChunk = async (chunk: TranscriptionChunk) => {
    const resolvedProvider = resolveProviderConfig();
    if (resolvedProvider.providerType !== "gemini") {
      setError("Transcription retry is available for Gemini runs only");
      return;
    }
    if (!apiKey) {
      setError(`${resolvedProvider.providerLabel} API key is required for transcription retry`);
      return;
    }
    if (!videoRef && !(useInlineChunks && mediaFile)) {
      setError("No media file available for transcription retry");
      return;
    }

    const chunkLength = providerConfigs.openai.transcriptionChunkSeconds ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS;
    const overlapSeconds = Math.max(0, transcriptionOverlapSeconds ?? 0);
    const totalDuration = videoDuration && Number.isFinite(videoDuration) ? videoDuration : null;

    try {
      await transcriptionActions.retryChunk(chunk, {
        provider: "gemini",
        videoRef: videoRef ?? "",
        videoFile: mediaFile ?? undefined,
        useInlineChunks,
        apiKey: resolvedProvider.apiKeyForProvider,
        modelName: resolvedProvider.modelForProvider,
        chunkLength,
        overlapSeconds,
        videoDuration: totalDuration,
        prompt: transcriptionPrompt,
        temperature: DEFAULT_TEMPERATURE,
        safetyOff,
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription retry failed");
    }
  };

  const resetWorkflow = () => {
    // Reset run state only; keep user-configured options and text fields.
    setError("");
    setSubmitting(false);
    runnerActions.reset();
    transcriptionActions.reset();
  };

  const clearPreferences = () => {
    // Reset non-sensitive preferences to defaults; keep files and API key intact.
    setModels(DEFAULT_MODELS);
    setModelName(DEFAULT_MODEL);
    setMediaResolution("low");
    setUseAudioOnly(DEFAULT_USE_AUDIO_ONLY);
    tActions.setTargetLang(DEFAULT_TARGET_LANG);
    tActions.setChunkSeconds(DEFAULT_CHUNK_SECONDS);
    tActions.setChunkOverlap(DEFAULT_OVERLAP_CUES);
    setConcurrencyClamped(DEFAULT_CONCURRENCY);
    tActions.setTemperature(DEFAULT_TEMPERATURE);
    tActions.setCustomPrompt(DEFAULT_SYSTEM_PROMPT_TEXT);
    // Keep user-entered summary/glossary content
    tActions.setSummaryPrompt(DEFAULT_SUMMARY_PROMPT);
    tActions.setGlossaryPrompt(DEFAULT_GLOSSARY_PROMPT);
    tActions.setUseSummary(DEFAULT_USE_SUMMARY);
    tActions.setUseGlossary(DEFAULT_USE_GLOSSARY);
    tActions.setUseGlossaryInSummary(false);
    setSafetyOff(false);
    try {
      clearPrefs();
      window.localStorage.removeItem("theme");
    } catch {
      // ignore storage errors
    }
  };

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
      targetLang: tState.targetLang,
      concurrency: tState.concurrency,
      chunkSeconds: tState.chunkSeconds,
      chunkOverlap: tState.chunkOverlap,
      models,
      modelName,
      workflowMode,
      customPrompt: tState.customPrompt,
      glossary: tState.glossary,
      useGlossary: tState.useGlossary,
      apiKey,
      videoName,
      videoRef,
      videoUploadState,
      videoUploadMessage,
      mediaTooLargeWarning,
      videoSizeMb,
      videoDuration,
      temperature: tState.temperature,
      paused:
        workflowMode === "translation"
          ? runnerState.paused
          : transcriptionState.isPaused,
      isRunning:
        workflowMode === "translation"
          ? runnerState.isRunning
          : transcriptionState.isRunning,
      error,
      statusMessage,
      submitting,
      retryingChunks: runnerState.retryingChunks,
      retryQueueIds: runnerState.retryQueueIds,
      summaryText: tState.summaryText,
      summaryStatus: tState.summaryStatus,
      summaryError: tState.summaryError,
      glossaryStatus: tState.glossaryStatus,
      glossaryError: tState.glossaryError,
      summaryPrompt: tState.summaryPrompt,
      useSummary: tState.useSummary,
      glossaryPrompt: tState.glossaryPrompt,
      promptPreview: tState.promptPreview,
      safetyOff,
      mediaResolution,
      currentPreset: tState.currentPreset,
      customPresets: tState.customPresets,
      allPresets: tState.allPresets,
      useGlossaryInSummary: tState.useGlossaryInSummary,
      transcriptionRunning: transcriptionState.isRunning,
      transcriptionPaused: transcriptionState.isPaused,
      translationResult: tState.runnerState.result,
      translationProgress: tState.runnerState.progress,
      transcriptionResult: transcriptionState.result,
      transcriptionProgress: transcriptionState.progress,
      // Transcription state
      providerConfigs,
      audioFile,
      transcriptionText,
      transcriptionStatus,
      useTranscription: useTranscriptionEnabled,
      useTranscriptionForSummary,
      transcriptionPrompt,
      transcriptionOverlapSeconds,
      useInlineChunks,
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
      setUseTranscription: setUseTranscriptionEnabled, // New action
      setUseTranscriptionForSummary,
      setTranscriptionPrompt,
      setTranscriptionOverlapSeconds,
      setUseInlineChunks,
      handleTranscribeAudio, // New action
      handleManualChunkEdit,
      setUseAudioOnly,
      setTargetLang: translationWorkflow.actions.setTargetLang,
      setConcurrency: translationWorkflow.actions.setConcurrency,
      setChunkSeconds: translationWorkflow.actions.setChunkSeconds,
      setChunkOverlap: translationWorkflow.actions.setChunkOverlap,
      setModelName,
      setCustomPrompt: translationWorkflow.actions.setCustomPrompt,
      setGlossary: translationWorkflow.actions.setGlossary,
      setUseGlossary: translationWorkflow.actions.setUseGlossary,
      setTemperature: translationWorkflow.actions.setTemperature,
      handleSubmit,
      handleLoadModels,
      handleGenerateGlossary,
      handleGenerateSummary,
      handleRetryChunk,
      handleRetryTranscriptionChunk,
      handleUploadVideo,
      handleDeleteVideo,
      resetWorkflow,
      clearPreferences,
      setSummaryText: tActions.setSummaryText,
      setUseSummary: tActions.setUseSummary,
      setGlossaryPrompt: tActions.setGlossaryPrompt,
      setSummaryPrompt: tActions.setSummaryPrompt,
      setSafetyOff,
      setMediaResolution,
      setWorkflowMode,
      pause: runnerActions.pause,
      resume: runnerActions.resume,
      pauseTranscription,
      resumeTranscription,
      cancelTranscription,
      applyPreset: tActions.applyPreset,
      applyCustomPreset: tActions.applyCustomPreset,
      exportCurrentAsPreset: tActions.exportCurrentAsPreset,
      importPresetsFromJson: tActions.importPresetsFromJson,
      deleteCustomPreset: tActions.deleteCustomPreset,
      exportAllCustomPresets: tActions.exportAllCustomPresets,
      clearCustomPresets: tActions.clearCustomPresets,
      setUseGlossaryInSummary: tActions.setUseGlossaryInSummary,
    },
  };
}
