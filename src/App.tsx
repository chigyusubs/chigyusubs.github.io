import React from "react";
import { useTranslationWorkflowRunner } from "./hooks/useTranslationWorkflowRunner";
import { ProviderSettings } from "./components/ProviderSettings";
import { FileUploader } from "./components/FileUploader";
import { TranslationProgress } from "./components/TranslationProgress";
import { ResultView } from "./components/ResultView";
import { ProviderDebugLog } from "./components/ProviderDebugLog";
import { Button } from "./components/ui/Button";
import { SectionCard } from "./components/ui/SectionCard";
import { FieldLabel, TextArea, TextInput } from "./components/ui/Field";
import { useTheme, useThemeControl } from "./lib/themeContext";
import {
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SYSTEM_PROMPT_TEXT,
  MAX_CONCURRENCY,
  PROMPT_PRESETS,
} from "./config/defaults";
import { RestoreButton } from "./components/RestoreButton";
import { getProviderCapability } from "./lib/providers/capabilities";

function App() {
  const { state, actions } = useTranslationWorkflowRunner();
  const theme = useTheme();
  const { name: themeName, toggleTheme } = useThemeControl();
  const running = state.isRunning;
  const locked = state.submitting || running;
  const providerCapability = getProviderCapability(state.selectedProvider);
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

  return (
    <div className={theme.page}>
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
                Translate subtitles (VTT or SRT) using AI translation.
              </p>
            </div>
          </div>
          <div>
            <Button tone="secondary" onClick={toggleTheme} className="text-sm">
              {themeName === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 pb-20">
        <form className="space-y-6" onSubmit={actions.handleSubmit}>
          <SectionCard
            title="Mode"
            subtitle="Switch between translation and transcription."
          >
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value="translation"
                  checked={state.workflowMode === "translation"}
                  onChange={() => actions.setWorkflowMode("translation")}
                  disabled={locked}
                />
                <span>Translation</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value="transcription"
                  checked={state.workflowMode === "transcription"}
                  onChange={() => actions.setWorkflowMode("transcription")}
                  disabled={locked}
                />
                <span>Transcription (Gemini)</span>
              </label>
              {state.workflowMode === "transcription" && state.selectedProvider !== "gemini" && (
                <span className={`text-xs ${theme.dangerText}`}>
                  Transcription mode requires Gemini; switch provider to continue.
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
            workflowMode={state.workflowMode}
          />

          <FileUploader
            vttFile={state.vttFile}
            setVttFile={actions.setVttFile}
            mediaFile={state.mediaFile}
            setMediaFile={actions.setMediaFile}
            useAudioOnly={state.useAudioOnly}
            setUseAudioOnly={actions.setUseAudioOnly}
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

            // Transcription props
            showAudioUpload={state.selectedProvider === "openai" && state.providerConfigs.openai.transcriptionEnabled}
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
          </SectionCard>

          <div className="flex justify-end items-center mt-8 mb-12 gap-3">
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
              disabled={!running && !state.paused && !state.result}
              title="Reset clears progress, drops queued work, and keeps uploaded media. Enabled when running, paused, or after results."
            >
              Reset
            </Button>
            <Button
              type="submit"
              tone="upload"
              disabled={
                state.submitting || !state.vttFile || (state.selectedProvider !== "ollama" && !state.apiKey) || locked
              }
            >
              {state.submitting ? (
                <span className="animate-pulse">Translating...</span>
              ) : (
                "Start Translation"
              )}
            </Button>
          </div>
        </form>

        <TranslationProgress progress={state.progress} result={state.result} />

        <ResultView
          result={state.result}
          handleRetryChunk={actions.handleRetryChunk}
          handleManualChunkEdit={actions.handleManualChunkEdit}
          retryingChunks={state.retryingChunks}
          retryQueueIds={state.retryQueueIds}
        />

        {state.statusMessage && (
          <div className={`p-4 rounded ${theme.well.info}`}>
            <p className="font-bold">Status</p>
            <p>{state.statusMessage}</p>
          </div>
        )}

        {state.error && (
          <div className={`p-4 rounded ${theme.well.error}`}>
            <p className="font-bold">Error</p>
            <p>{state.error}</p>
          </div>
        )}

        <ProviderDebugLog />
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
      <footer
        className={`${theme.header} text-center text-sm ${theme.subtext}`}
      >
        <p className={theme.text}>
          ChigyuSubs — AI-powered subtitle translation ·{" "}
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
