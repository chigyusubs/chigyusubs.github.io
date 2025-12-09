import React from "react";
import { LABELS } from "../config/ui";
import { useTheme } from "../lib/themeContext";
import { Button } from "./ui/Button";
import { SectionCard } from "./ui/SectionCard";
import { FieldLabel, TextInput } from "./ui/Field";

type Props = {
  apiKey: string;
  setApiKey: (key: string) => void;
  modelName: string;
  setModelName: (name: string) => void;
  models: string[];
  handleLoadModels: () => void;
  submitting: boolean;
  error: string;
  temperature: number;
  setTemperature: (t: number) => void;
  safetyOff: boolean;
  setSafetyOff: (v: boolean) => void;
  mediaResolution: "low" | "standard";
  setMediaResolution: (v: "low" | "standard") => void;
  locked?: boolean;
};

export function GeminiSettings({
  apiKey,
  setApiKey,
  modelName,
  setModelName,
  models,
  handleLoadModels,
  submitting,
  error,
  temperature,
  setTemperature,
  safetyOff,
  setSafetyOff,
  mediaResolution,
  setMediaResolution,
  locked = false,
}: Props) {
  const theme = useTheme();
  return (
    <SectionCard
      title="Gemini settings"
      subtitle="Enter your Gemini key and pick a model."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <FieldLabel>Gemini API key</FieldLabel>
          <TextInput
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your API key (not stored)"
            name="gemini-api-key"
            autoComplete="current-password"
            spellCheck={false}
            required
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Model</FieldLabel>
          <select
            className={theme.input}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={locked}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button
              type="button"
              tone="upload"
              onClick={handleLoadModels}
              disabled={submitting || !apiKey || locked}
              title="Requires your Gemini API key to list models"
              className="text-sm"
            >
              {LABELS.refreshModels}
            </Button>
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <FieldLabel>Temperature</FieldLabel>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-[0_0_50%] min-w-[240px]">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="range-input flex-1 max-w-xs accent-orange-500"
                disabled={locked}
              />
              <span className="w-12 text-right text-sm">
                {temperature.toFixed(2)}
              </span>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={safetyOff}
                onChange={(e) => setSafetyOff(e.target.checked)}
                disabled={locked}
                title="Turns off Gemini safety filters; use sparingly (may trigger review for unsafe content)."
              />
              <span>Disable Gemini safety settings (use with caution)</span>
            </label>
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <FieldLabel>Media resolution (summaries)</FieldLabel>
          <select
            className={theme.input}
            value={mediaResolution}
            onChange={(e) =>
              setMediaResolution(e.target.value as "low" | "standard")
            }
            disabled={locked}
          >
            <option value="low">Low (token saver)</option>
            <option value="standard">Standard (more detail)</option>
          </select>
          <p className={theme.helperText}>
            Low cuts token usage for video summaries. Switch to standard if
            visual detail is missing.
          </p>
        </div>
      </div>
      {error && error.toLowerCase().includes("api key") && (
        <p className={`text-sm ${theme.dangerText} mt-2`}>{error}</p>
      )}
    </SectionCard>
  );
}
