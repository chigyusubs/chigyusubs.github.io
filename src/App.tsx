import React from "react";
import { useTranslationWorkflowRunner } from "./hooks/useTranslationWorkflowRunner";
import { ProviderSettings } from "./components/ProviderSettings";
import { FileUploader } from "./components/FileUploader";
import { TranslationProgress } from "./features/translation/components/TranslationProgress";
import { ResultView } from "./features/translation/components/ResultView";
import { TranscriptionProgress } from "./features/transcription/components/TranscriptionProgress";
import { TranscriptionResultView } from "./features/transcription/components/TranscriptionResultView";
import { ProviderApiLog } from "./components/ProviderApiLog";
import { Button } from "./components/ui/Button";
import { SectionCard } from "./components/ui/SectionCard";
import { FieldLabel, TextArea, TextInput } from "./components/ui/Field";
import { useTheme, useThemeControl } from "./lib/themeContext";
import { RuntimeErrorBoundary } from "./components/RuntimeErrorBoundary";
import {
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  MAX_CONCURRENCY,
  PROMPT_PRESETS,
  TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
  TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS,
} from "./config/defaults";
import { buildTranscriptionPrompt } from "./lib/structured/TranscriptionStructuredPrompt";
import { formatTimestamp } from "./lib/structured/TranscriptionVttReconstructor";
import { TRANSCRIPTION_JSON_SCHEMA } from "./lib/structured/TranscriptionStructuredOutput";
import { RestoreButton } from "./components/RestoreButton";
import { getProviderCapability } from "./lib/providers/capabilities";
import { TranscriptionSettings } from "./features/transcription/components/TranscriptionSettings";
import { isDebugEnabled } from "./lib/debugToggle";
import {
  copyDebugBuffer,
  disableDebugEvents,
  enableDebugEvents,
  setDebugWriter,
} from "./lib/debugState";
import type { StructuredCueHintMode } from "./lib/structured/StructuredPrompt";
// ============================================================================
// MOCK MODE UI (can be removed with src/lib/mock/)
// ============================================================================
import { MockModeIndicator } from "./components/MockModeIndicator";
// ============================================================================

function App() {
  const { state, actions } = useTranslationWorkflowRunner();
  const theme = useTheme();
  const { name: themeName, toggleTheme } = useThemeControl();
  const isDarkTheme = themeName === "dark";
  const [showTranscriptionPromptModal, setShowTranscriptionPromptModal] = React.useState(false);
  const debugOn = isDebugEnabled();
  React.useEffect(() => {
    if (debugOn) {
      enableDebugEvents();
      setDebugWriter((event) => {
        // Log to console for live visibility when debug is enabled
        // Avoid serializing large payloads unnecessarily.
        console.debug("[debug-event]", event.kind, {
          runId: event.runId,
          chunkIdx: event.chunkIdx,
          message: event.message,
          data: event.data,
        });
      });
      return () => {
        setDebugWriter(null);
        disableDebugEvents();
      };
    }
    setDebugWriter(null);
    disableDebugEvents();
    return undefined;
  }, [debugOn]);
  const running = state.isRunning;
  const locked = state.submitting || running;
  const providerCapability = getProviderCapability(state.selectedProvider);
  const chunkSeconds =
    state.providerConfigs.openai.transcriptionChunkSeconds ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS;
  const breakWindow = Math.min(
    Math.max(state.transcriptionOverlapSeconds ?? TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS, 0),
    chunkSeconds,
  );
  const structuredPromptPreview = React.useMemo(
    () =>
      buildTranscriptionPrompt({
        isFirstChunk: true,
        videoStart: formatTimestamp(0),
        videoEnd: formatTimestamp(chunkSeconds),
        breakWindowStart: formatTimestamp(Math.max(0, chunkSeconds - breakWindow)),
        breakWindowEnd: formatTimestamp(chunkSeconds),
        lastTwoCues: undefined,
        nextCueNumber: 1,
      }),
    [breakWindow, chunkSeconds],
  );
  const schemaPretty = React.useMemo(
    () => JSON.stringify(TRANSCRIPTION_JSON_SCHEMA, null, 2),
    [],
  );
  const summaryButtonLabel =
    state.summaryStatus === "loading"
      ? "Generating..."
      : state.mediaFile
        ? "Generate summary from media"
        : "Generate summary from subtitles";
  const hasSummarySource = state.mediaFile
    ? !!state.videoRef
    : !!state.vttFile ||
    (state.useTranscriptionForSummary &&
      !!state.transcriptionText.trim());
  const canGenerateSummary =
    (!providerCapability.requiresApiKey || !!state.apiKey) &&
    hasSummarySource &&
    state.summaryStatus !== "loading" &&
    !locked;
  const startButtonLabel =
    state.workflowMode === "transcription"
      ? state.submitting
        ? "Transcribing..."
        : "Start Transcription"
      : state.submitting
        ? "Translating..."
        : "Start Translation";

  // Dynamic status badge text
  const getStatusText = () => {
    if (state.workflowMode === "translation") {
      if (!running && !state.translationResult) return null;

      // Check for active retries (deduplicate chunk IDs)
      const retryingIds = new Set([
        ...(state.retryingChunks || []),
        ...(state.retryQueueIds || [])
      ]);
      const totalRetrying = retryingIds.size;

      if (totalRetrying > 0) {
        return `Retrying ${totalRetrying} chunk${totalRetrying > 1 ? 's' : ''}`;
      }

      if (state.paused) return "Paused";
      if (running) {
        const okChunks = state.translationResult?.chunks.filter(c => c.status === "ok").length || 0;
        const totalChunks = state.translationResult?.chunks.length || 0;
        return totalChunks > 0 ? `Translating (${okChunks}/${totalChunks})` : "Translating...";
      }
      if (state.translationResult?.ok) return "Completed";
      const okChunks = state.translationResult?.chunks.filter(c => c.status === "ok").length || 0;
      const totalChunks = state.translationResult?.chunks.length || 0;
      const failedChunks = state.translationResult?.chunks.filter(c => c.status === "failed").length || 0;
      if (failedChunks > 0) return `${failedChunks} chunk${failedChunks > 1 ? 's' : ''} failed`;
      if (okChunks === totalChunks && totalChunks > 0) return "Completed";
      return null;
    } else {
      if (!state.transcriptionRunning && !state.transcriptionResult) return null;
      if (state.transcriptionPaused) return "Paused";
      if (state.transcriptionRunning) {
        const okChunks = state.transcriptionResult?.chunks.filter(c => c.status === "ok").length || 0;
        const totalChunks = state.transcriptionResult?.chunks.length || 0;
        return totalChunks > 0 ? `Transcribing (${okChunks}/${totalChunks})` : "Transcribing...";
      }
      if (state.transcriptionResult?.ok) return "Completed";
      return null;
    }
  };

  const statusText = getStatusText();

  return (
    <div className={theme.page}>
      {/* Mock mode indicator - DELETE THIS LINE to remove mock mode UI */}
      <MockModeIndicator />

      <header className={theme.header}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <img
              src="/gyudon.png"
              alt="Gyudon mascot"
              className="w-12 h-12 animate-float"
              style={{ imageRendering: "pixelated" }}
            />
            <div>
              <h1 className="text-2xl font-bold">ChigyuSubs</h1>
              <p className={`text-sm ${theme.subtext}`}>
                Browser-only subs for Japanese comedy (お笑い) & beyond.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {debugOn && (
              <Button
                tone="secondary"
                className="text-sm"
                onClick={async () => {
                  const text = copyDebugBuffer();
                  if (!text || !text.trim()) {
                    alert("No internal events logged yet.");
                    return;
                  }
                  if (navigator?.clipboard?.writeText) {
                    try {
                      await navigator.clipboard.writeText(text);
                      alert("Internal events copied");
                      return;
                    } catch {
                      // fall through to fallback
                    }
                  }
                  const textarea = document.createElement("textarea");
                  textarea.value = text;
                  textarea.style.position = "fixed";
                  textarea.style.left = "-1000px";
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand("copy");
                    alert("Internal events copied");
                  } catch {
                    alert(text);
                  } finally {
                    document.body.removeChild(textarea);
                  }
                }}
              >
                Debug mode: copy events
              </Button>
            )}
            <Button tone="secondary" onClick={toggleTheme} className="text-sm">
              {themeName === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </Button>
          </div>
        </div>
      </header>
      <RuntimeErrorBoundary>
        <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 pb-20">
          <form className="space-y-6" onSubmit={actions.handleSubmit}>
            <SectionCard
              title="Mode"
              subtitle="Switch between translation and transcription."
            >
              <div className="space-y-2">
                <div
                  className={`inline-flex w-full flex-col gap-2 rounded-xl p-1 sm:w-auto ${
                    isDarkTheme
                      ? "border border-white/5 bg-white/[0.03] shadow-inner shadow-black/30"
                      : "border border-orange-100 bg-white shadow-inner shadow-orange-100/60"
                  }`}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        key: "translation",
                        label: "Translation",
                        icon: "🌐",
                        description: "VTT/SRT → translated subtitles",
                      },
                      {
                        key: "transcription",
                        label: "Transcription",
                        icon: "🎙️",
                        description: "Media → VTT (Gemini only)",
                      },
                    ].map((option) => {
                      const active = state.workflowMode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            option.key === "translation"
                              ? actions.setWorkflowMode("translation")
                              : actions.setWorkflowMode("transcription")
                          }
                          className={`relative flex min-w-[200px] flex-col items-start gap-1 rounded-lg px-4 py-3 text-left transition ${
                            active
                              ? isDarkTheme
                                ? "bg-white/10 text-white shadow-lg shadow-black/40"
                                : "bg-white text-slate-900 shadow-lg shadow-orange-100 border border-orange-100"
                              : isDarkTheme
                                ? "bg-transparent text-white/80 hover:text-white hover:bg-white/5"
                                : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-orange-50"
                          } ${locked ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                          aria-pressed={active}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <span className="text-base">{option.icon}</span>
                            <span>{option.label}</span>
                          </div>
                          <div
                            className={`text-xs ${
                              isDarkTheme ? "text-white/60" : "text-slate-600"
                            }`}
                          >
                            {option.description}
                          </div>
                          <span
                            className={`absolute left-3 right-3 bottom-1.5 h-[3px] rounded-full transition ${
                              active ? "bg-orange-400" : "bg-transparent"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {state.workflowMode === "transcription" &&
                  !["gemini", "openai"].includes(state.selectedProvider) && (
                    <span className={`text-xs ${theme.dangerText}`}>
                      Transcription mode requires Gemini or OpenAI; switch provider to continue.
                    </span>
                  )}
              </div>
            </SectionCard>

            <ProviderSettings
              selectedProvider={state.selectedProvider}
              setSelectedProvider={actions.setSelectedProvider}
              apiKeys={state.apiKeys}
              setApiKey={actions.setApiKey}
              ollamaBaseUrl={state.ollamaBaseUrl}
              setOllamaBaseUrl={actions.setOllamaBaseUrl}
              providerConfigs={state.providerConfigs}
              onProviderConfigChange={actions.updateProviderConfig}
              modelName={state.modelName}
              setModelName={actions.setModelName}
              models={state.models}
              handleLoadModels={actions.handleLoadModels}
              submitting={state.submitting}
              error={state.error}
              temperature={state.temperature}
              setTemperature={actions.setTemperature}
              safetyOff={state.safetyOff}
              setSafetyOff={actions.setSafetyOff}
              locked={locked}
              mediaResolution={state.mediaResolution}
              setMediaResolution={actions.setMediaResolution}
              thinkingBudget={state.thinkingBudget}
              setThinkingBudget={actions.setThinkingBudget}
              maxOutputTokens={state.maxOutputTokens}
              setMaxOutputTokens={actions.setMaxOutputTokens}
              topP={state.topP}
              setTopP={actions.setTopP}
              workflowMode={state.workflowMode}
            />

            <FileUploader
              vttFile={state.vttFile}
              setVttFile={actions.setVttFile}
              mediaFile={state.mediaFile}
              setMediaFile={actions.setMediaFile}
              supportsMediaUpload={providerCapability.supportsMediaUpload}
              videoRef={state.videoRef}
              videoUploadState={state.videoUploadState}
              videoUploadMessage={state.videoUploadMessage}
              videoSizeMb={state.videoSizeMb}
              videoDuration={state.videoDuration}
              mediaResolution={state.mediaResolution}
              handleUploadVideo={actions.handleUploadVideo}
              handleDeleteVideo={actions.handleDeleteVideo}
              submitting={state.submitting}
              apiKey={state.apiKey}
              locked={locked}
              mediaTooLargeWarning={state.mediaTooLargeWarning}
              mode={state.workflowMode}
              showSubtitles={state.workflowMode !== "transcription"}

              // Transcription props (Gemini only)
              showAudioUpload={false}
              audioFile={state.audioFile}
              setAudioFile={actions.setAudioFile}
              transcriptionText={state.transcriptionText}
              setTranscriptionText={actions.setTranscriptionText}
              transcriptionStatus={state.transcriptionStatus}
              onTranscribe={actions.handleTranscribeAudio}
              useTranscription={state.useTranscription}
              setUseTranscription={actions.setUseTranscription}
              useTranscriptionForSummary={state.useTranscriptionForSummary}
              setUseTranscriptionForSummary={actions.setUseTranscriptionForSummary}
            />

            {state.workflowMode === "translation" && (
              <SectionCard
                title="Prompts"
                subtitle="Configure translation prompts and load presets."
              >
                <div className="mb-3">
                  <FieldLabel>Target Language</FieldLabel>
                  <TextInput
                    value={state.targetLang}
                    onChange={(e) => actions.setTargetLang(e.target.value)}
                    disabled={locked}
                  />
                </div>

                <div className="mb-3">
                  <FieldLabel>Prompt Preset</FieldLabel>
                  <select
                    className={theme.input}
                    value={state.currentPreset}
                    onChange={(e) => {
                      const presetId = e.target.value;
                      if (!presetId) return;

                      // Check if it's a built-in preset
                      if (presetId in PROMPT_PRESETS) {
                        actions.applyPreset(
                          presetId as keyof typeof PROMPT_PRESETS,
                        );
                      } else {
                        // It's a custom preset
                        const customPreset = state.customPresets.find(
                          (p) => p.id === presetId,
                        );
                        if (customPreset) {
                          actions.applyCustomPreset(customPreset);
                        }
                      }
                    }}
                    disabled={locked}
                  >
                    {state.allPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                        {!preset.isBuiltIn ? " (Custom)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className={theme.helperText}>
                    Switching presets will update the system prompt, summary prompt,
                    and glossary prompt below.
                  </p>
                </div>

                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => {
                      const name = window.prompt("Enter a name for this preset:");
                      if (name) {
                        actions.exportCurrentAsPreset(name);
                      }
                    }}
                    disabled={locked}
                    className="text-sm"
                  >
                    Export Current
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".json";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const result = actions.importPresetsFromJson(text);
                          if (result.success) {
                            alert(
                              `Successfully imported ${result.count} preset(s)!`,
                            );
                          } else {
                            alert(`Import failed: ${result.error}`);
                          }
                        } catch {
                          alert("Failed to read file");
                        }
                      };
                      input.click();
                    }}
                    disabled={locked}
                    className="text-sm"
                  >
                    Import Presets
                  </Button>
                  {state.customPresets.length > 0 && (
                    <>
                      <Button
                        type="button"
                        tone="secondary"
                        onClick={() => actions.exportAllCustomPresets()}
                        disabled={locked}
                        className="text-sm"
                      >
                        Export All Custom
                      </Button>
                      <Button
                        type="button"
                        tone="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Clear all custom presets? This cannot be undone.",
                            )
                          ) {
                            actions.clearCustomPresets();
                          }
                        }}
                        disabled={locked}
                        className="text-sm"
                      >
                        Clear Custom Presets
                      </Button>
                    </>
                  )}
                </div>

                <details className="mt-3 mb-2">
                  <summary className={`cursor-pointer text-sm ${theme.subtext}`}>
                    Glossary Prompt
                  </summary>
                  <div className="flex justify-end mb-1">
                    <RestoreButton
                      onClick={() =>
                        actions.setGlossaryPrompt(DEFAULT_GLOSSARY_PROMPT)
                      }
                      disabled={
                        locked ||
                        state.glossaryPrompt.trim() ===
                        DEFAULT_GLOSSARY_PROMPT.trim()
                      }
                      title="Restore default glossary system prompt"
                    />
                  </div>
                  <TextArea
                    variant="code"
                    className="h-24 mt-2"
                    value={state.glossaryPrompt}
                    onChange={(e) => actions.setGlossaryPrompt(e.target.value)}
                    disabled={locked}
                  />
                </details>

                <details className="mt-3 mb-2">
                  <summary className={`cursor-pointer text-sm ${theme.subtext}`}>
                    Summary Prompt
                  </summary>
                  <div className="flex justify-end mb-1">
                    <RestoreButton
                      onClick={() =>
                        actions.setSummaryPrompt(DEFAULT_SUMMARY_PROMPT)
                      }
                      disabled={
                        locked ||
                        state.summaryPrompt.trim() === DEFAULT_SUMMARY_PROMPT.trim()
                      }
                      title="Restore default summary system prompt"
                    />
                  </div>
                  <TextArea
                    variant="code"
                    className="h-24 mt-2"
                    value={state.summaryPrompt}
                    onChange={(e) => actions.setSummaryPrompt(e.target.value)}
                    disabled={locked}
                  />
                </details>
                <details className="mt-4">
                  <summary className={`cursor-pointer text-sm ${theme.subtext}`}>
                    Translation System Prompt
                  </summary>
                  <div className="flex justify-end mt-2">
                    <RestoreButton
                      onClick={() =>
                        actions.setCustomPrompt(DEFAULT_SYSTEM_PROMPT_TEXT)
                      }
                      disabled={
                        locked ||
                        state.customPrompt.trim() ===
                        DEFAULT_SYSTEM_PROMPT_TEXT.trim()
                      }
                      title="Restore default system prompt"
                    />
                  </div>
                  <TextArea
                    variant="code"
                    className="h-32 mt-2"
                    value={state.customPrompt}
                    onChange={(e) => actions.setCustomPrompt(e.target.value)}
                    placeholder="Override the default system prompt..."
                    disabled={locked}
                  />
                </details>

                <details className="mt-4">
                  <summary className={`cursor-pointer text-sm ${theme.subtext}`}>
                    User Prompt Preview
                  </summary>
                  <pre
                    className="mt-2 p-3 rounded border text-base whitespace-pre-wrap h-48 overflow-y-auto"
                    style={{
                      backgroundColor: theme.codeBackground,
                      borderColor: theme.borderColor,
                    }}
                  >
                    {state.promptPreview}
                  </pre>
                </details>
              </SectionCard>
            )}

            {state.workflowMode === "transcription" && (
              <SectionCard
                title="Transcription Prompt"
                subtitle="Optional extra instructions appended to the structured Gemini prompt."
              >
                <div className="flex justify-between items-center mb-2">
                  <p className={`text-sm ${theme.subtext}`}>Appends after the structured prompt (leave empty for default behavior).</p>
                  <Button
                    tone="secondary"
                    size="sm"
                    onClick={() => setShowTranscriptionPromptModal(true)}
                    disabled={locked}
                  >
                    View structured prompt
                  </Button>
                </div>
                <TextArea
                  variant="code"
                  className="h-32"
                  value={state.transcriptionPrompt}
                  onChange={(e) => actions.setTranscriptionPrompt(e.target.value)}
                  disabled={locked}
                  placeholder="Additional instructions (optional)..."
                />
                {state.transcriptionPrompt && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      tone="secondary"
                      size="sm"
                      onClick={() => actions.setTranscriptionPrompt("")}
                      disabled={locked}
                    >
                      Clear prompt
                    </Button>
                  </div>
                )}
              </SectionCard>
            )}

            {state.workflowMode === "transcription" && (
              <SectionCard
                title="Transcription settings"
                subtitle={
                  "Chunking and parallelism for Gemini transcription."
                }
              >
                <TranscriptionSettings
                  provider="gemini"
                  locked={locked}
                  openaiConfig={state.providerConfigs.openai}
                  onUpdateOpenaiConfig={(cfg) => actions.updateProviderConfig("openai", cfg)}
                  transcriptionOverlapSeconds={state.transcriptionOverlapSeconds ?? TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS}
                  setTranscriptionOverlapSeconds={(val) =>
                    actions.setTranscriptionOverlapSeconds(Math.max(0, val))
                  }
                />
              </SectionCard>
            )}


            {state.workflowMode === "translation" && (
              <SectionCard
                title="Context (optional)"
                subtitle="Generate media summary and glossary to guide translations."
              >
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    type="button"
                    tone="upload"
                    onClick={actions.handleGenerateGlossary}
                    disabled={
                      !state.vttFile || state.glossaryStatus === "loading" || locked
                    }
                    title={
                      !state.vttFile
                        ? "Load subtitles to generate a glossary"
                        : undefined
                    }
                  >
                    {state.glossaryStatus === "loading"
                      ? "Generating..."
                      : "Generate Glossary"}
                  </Button>
                </div>
                <TextArea
                  variant="code"
                  className="h-32"
                  placeholder="Glossary (source,target)..."
                  value={state.glossary}
                  onChange={(e) => {
                    actions.setGlossary(e.target.value);
                    actions.setUseGlossary(!!e.target.value.trim());
                  }}
                  disabled={locked}
                />
                <label className="inline-flex items-center gap-2 text-sm mt-2">
                  <input
                    type="checkbox"
                    checked={state.useGlossary}
                    onChange={(e) => actions.setUseGlossary(e.target.checked)}
                    disabled={locked}
                  />
                  <span>Use glossary for translation</span>
                </label>
                {state.glossaryError && (
                  <p className={`text-sm ${theme.dangerText} mt-2`}>
                    {state.glossaryError}
                  </p>
                )}

                <hr className="my-4" style={{ borderColor: theme.borderColor }} />

                <div className="flex items-center gap-2 mb-3">
                  <Button
                    type="button"
                    tone="upload"
                    onClick={actions.handleGenerateSummary}
                    disabled={!canGenerateSummary || state.workflowMode === "transcription"}
                  >
                    {summaryButtonLabel}
                  </Button>
                  {state.summaryStatus === "ready" && (
                    <span className={`text-xs ${theme.successText}`}>
                      Generated
                    </span>
                  )}
                  {state.summaryStatus === "error" && (
                    <span className={`text-xs ${theme.dangerText}`}>Error</span>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={state.useGlossaryInSummary}
                      onChange={(e) =>
                        actions.setUseGlossaryInSummary(e.target.checked)
                      }
                      disabled={locked || !state.glossary.trim()}
                    />
                    <span>Use glossary in summary generation</span>
                  </label>
                </div>
                {state.summaryError && (
                  <p className={`text-sm ${theme.dangerText} mb-2`}>
                    {state.summaryError}
                  </p>
                )}
                <TextArea
                  variant="code"
                  className="h-32"
                  placeholder="Summary context..."
                  value={state.summaryText}
                  onChange={(e) => {
                    actions.setSummaryText(e.target.value);
                    actions.setUseSummary(!!e.target.value.trim());
                  }}
                  disabled={locked}
                />
                <label className="inline-flex items-center gap-2 text-sm mt-2">
                  <input
                    type="checkbox"
                    checked={state.useSummary}
                    onChange={(e) => actions.setUseSummary(e.target.checked)}
                    disabled={locked}
                  />
                  <span>Use summary for translation</span>
                </label>
              </SectionCard>
            )}

            {state.workflowMode === "translation" && (
              <SectionCard
                title="Translation settings"
                subtitle="Set chunking and model controls."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Chunk Size</FieldLabel>
                    <select
                      className={theme.input}
                      value={state.chunkSeconds}
                      onChange={(e) =>
                        actions.setChunkSeconds(Number(e.target.value))
                      }
                      disabled={locked}
                    >
                      {[1, 2, 3, 5, 10, 12, 15, 20, 25, 30, 40].map((min) => {
                        const seconds = min * 60;
                        return (
                          <option key={seconds} value={seconds}>
                            {min} minute{min === 1 ? "" : "s"}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Overlap</FieldLabel>
                    <select
                      className={theme.input}
                      value={state.chunkOverlap}
                      onChange={(e) =>
                        actions.setChunkOverlap(Number(e.target.value))
                      }
                      disabled={locked}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((ov) => (
                        <option key={ov} value={ov}>
                          {ov} cue{ov === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Concurrency</FieldLabel>
                    <select
                      className={theme.input}
                      value={state.concurrency}
                      onChange={(e) =>
                        actions.setConcurrency(Number(e.target.value))
                      }
                      disabled={locked}
                    >
                      {Array.from(
                        { length: MAX_CONCURRENCY },
                        (_, idx) => idx + 1,
                      ).map((c) => {
                        const label = c === 1 ? "Single task" : `${c} parallel`;
                        return (
                          <option key={c} value={c}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <p className={theme.helperText}>
                      Capped at {MAX_CONCURRENCY} to respect free-tier RPM.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      checked={state.useStructuredOutput}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        actions.setUseStructuredOutput(checked);
                        if (checked) {
                          actions.applyPreset("structured");
                        } else {
                          actions.applyPreset("general");
                        }
                      }}
                      disabled={locked}
                    />
                    <span>
                      Structured translation (JSON, merge-aware){" "}
                      <span className={theme.subtext}>
                        — Uses cue timestamps; allows merging short cues. Best with Gemini 2.5/3 or GPT-4+.
                      </span>
                    </span>
                  </label>
                  {state.useStructuredOutput && (
                    <div className="mt-3 flex flex-col gap-1">
                      <FieldLabel>Structured cue hinting</FieldLabel>
                      <select
                        className={theme.input}
                        value={state.structuredCueHintMode}
                        onChange={(e) =>
                          actions.setStructuredCueHintMode(
                            e.target.value as StructuredCueHintMode,
                          )
                        }
                        disabled={locked}
                      >
                        <option value="duration">
                          Duration hints (seconds per cue)
                        </option>
                        <option value="short-tag">
                          [SHORT] tags for sub-1.5s cues
                        </option>
                      </select>
                      <p className={theme.helperText}>
                        Use [SHORT] tags to reduce clutter and nudge merges; keep durations if you want exact lengths visible.
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            <div className="flex justify-end items-center mt-8 mb-12 gap-3 flex-wrap">
              {statusText && (
                <span
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${theme.well.info}`}
                  title="Current workflow phase"
                >
                  <span className="text-[11px] uppercase tracking-wide">Status</span>
                  <span className="text-sm">{statusText}</span>
                </span>
              )}
              {state.workflowMode === "translation" ? (
                <>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={state.paused ? actions.resume : actions.pause}
                    disabled={!running}
                    title="Pause stops starting new chunks/retries; in-flight calls continue."
                  >
                    {state.paused ? "Resume" : "Pause"}
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={actions.resetWorkflow}
                    disabled={!running && !state.paused && !state.translationResult}
                    title="Reset clears progress, drops queued work, and keeps uploaded media. Enabled when running, paused, or after results."
                  >
                    Reset
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={state.transcriptionPaused ? actions.resumeTranscription : actions.pauseTranscription}
                    disabled={
                      !state.transcriptionRunning &&
                      !state.transcriptionResult?.chunks.some(c => c.status === "processing" || c.status === "waiting")
                    }
                    title="Pause stops starting new transcription chunks."
                  >
                    {state.transcriptionPaused ? "Resume" : "Pause"}
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={actions.cancelTranscription}
                    disabled={
                      !state.transcriptionRunning &&
                      !state.transcriptionResult
                    }
                    title="Cancel current transcription run."
                  >
                    Reset
                  </Button>
                </>
              )}
              <Button
                type="submit"
                tone="upload"
                disabled={
                  state.submitting ||
                  locked ||
                  (state.workflowMode === "translation"
                    ? (!!state.translationResult || !state.vttFile || (state.selectedProvider !== "ollama" && !state.apiKey))
                    : (
                      !!state.transcriptionResult ||
                      !state.apiKey ||
                      (
                        state.selectedProvider === "gemini"
                          ? (!state.videoRef)
                          : state.selectedProvider === "openai"
                            ? !state.mediaFile
                            : true
                      )
                    ))
                }
                title={
                  state.workflowMode === "translation" && state.translationResult
                    ? "Translation complete. Click Reset to start a new translation."
                    : state.workflowMode === "transcription" && state.transcriptionResult
                      ? "Transcription complete. Click Reset to start a new transcription."
                      : undefined
                }
              >
                {state.submitting ? (
                  <span className="animate-pulse">{startButtonLabel}</span>
                ) : (
                  startButtonLabel
                )}
              </Button>
            </div>
          </form>

          {state.workflowMode === "translation" ? (
            <TranslationProgress
              progress={state.translationProgress}
              result={state.translationResult}
            />
          ) : (
            <TranscriptionProgress
              progress={state.transcriptionProgress}
              result={state.transcriptionResult}
            />
          )}

          {state.workflowMode === "translation" ? (
            <ResultView
              result={state.translationResult}
              handleRetryChunk={actions.handleRetryChunk}
              handleManualChunkEdit={actions.handleManualChunkEdit}
              retryingChunks={state.retryingChunks}
              retryQueueIds={state.retryQueueIds}
            />
          ) : (
            <TranscriptionResultView
              result={state.transcriptionResult}
              onRetryChunk={actions.handleRetryTranscriptionChunk}
              onResume={actions.resumeTranscription}
            />
          )}

          {state.error && (
            <div className={`p-4 rounded ${theme.well.error}`}>
              <p className="font-bold">Error</p>
              <p>{state.error}</p>
            </div>
          )}

          <ProviderApiLog />
          <div className="flex justify-end">
            <Button
              type="button"
              tone="secondary"
              onClick={actions.clearPreferences}
              disabled={locked}
              title="Restore defaults for models/prompts/settings; keeps summary/glossary text. Does not affect files or API key."
              className="text-xs"
            >
              Restore defaults
            </Button>
          </div>
        </main>
        {showTranscriptionPromptModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={() => setShowTranscriptionPromptModal(false)}
          >
            <div
              className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col border"
              onClick={(e) => e.stopPropagation()}
              style={{ borderColor: theme.borderColor }}
            >
              <div className="px-6 py-4 border-b" style={{ borderColor: theme.borderColor }}>
                <h2 className="text-xl font-semibold" style={{ color: theme.text }}>
                  Structured Transcription Prompt
                </h2>
                <p className="text-sm mt-1" style={{ color: theme.mutedText }}>
                  System + user prompt shown below. Your additional instructions are appended at the end.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <div className="font-semibold mb-1" style={{ color: theme.text }}>System prompt</div>
                  <pre
                    className="whitespace-pre-wrap break-words bg-black/40 p-3 rounded text-xs overflow-auto"
                    style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor, borderWidth: 1 }}
                  >
                    {structuredPromptPreview.systemPrompt}
                  </pre>
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: theme.text }}>User prompt (first chunk)</div>
                  <pre
                    className="whitespace-pre-wrap break-words bg-black/40 p-3 rounded text-xs overflow-auto"
                    style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor, borderWidth: 1 }}
                  >
                    {structuredPromptPreview.userPrompt}
                  </pre>
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: theme.text }}>Your additional instructions</div>
                  <TextArea
                    variant="code"
                    className="h-32"
                    value={state.transcriptionPrompt}
                    onChange={(e) => actions.setTranscriptionPrompt(e.target.value)}
                    disabled={locked}
                    placeholder="Optional: appended after the structured prompt"
                  />
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: theme.text }}>Structured output schema</div>
                  <pre
                    className="whitespace-pre bg-black/40 p-3 rounded text-xs overflow-auto"
                    style={{ backgroundColor: theme.codeBackground, borderColor: theme.borderColor, borderWidth: 1 }}
                  >
                    {schemaPretty}
                  </pre>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: theme.borderColor }}>
                <Button tone="secondary" onClick={() => setShowTranscriptionPromptModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </RuntimeErrorBoundary>
      <footer
        className={`${theme.header} text-center text-sm ${theme.subtext}`}
      >
        <p className={theme.text}>
          ChigyuSubs runs entirely in your browser: no accounts, no server, and no key storage.
          {" "}
          Your subtitles and media are sent only to the AI providers you configure (Google,
          OpenAI, etc.), under their data policies. ·{" "}
          <a
            href="https://github.com/chigyusubs/chigyusubs.github.io"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
