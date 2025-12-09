import React from "react";
import type { ProviderType } from "../../../lib/providers/types";
import { FieldLabel, TextInput } from "../../../components/ui/Field";
import { useTheme } from "../../../lib/themeContext";
import {
  TRANSCRIPTION_DEFAULT_CONCURRENCY,
  TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
  TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS,
} from "../../../config/defaults";

type OpenAIConfig = {
  transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
  transcriptionLanguage?: string;
  transcriptionConcurrency?: number;
  transcriptionChunkSeconds?: number;
};

type Props = {
  provider: ProviderType;
  locked: boolean;
  openaiConfig: OpenAIConfig;
  onUpdateOpenaiConfig: (config: OpenAIConfig) => void;
  transcriptionOverlapSeconds: number;
  setTranscriptionOverlapSeconds: (seconds: number) => void;
};

export function TranscriptionSettings({
  provider,
  locked,
  openaiConfig,
  onUpdateOpenaiConfig,
  transcriptionOverlapSeconds,
  setTranscriptionOverlapSeconds,
}: Props) {
  const theme = useTheme();
  const isGemini = provider === "gemini";
  const isOpenAI = provider === "openai";

  return (
    <div className="space-y-4">
      {/* OpenAI-specific toggles */}
      {isOpenAI && (
        <div className="space-y-4">
          <div>
            <FieldLabel>Force whisper-1 (legacy VTT, slower)</FieldLabel>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={openaiConfig.transcriptionModel === "whisper-1"}
                onChange={(e) =>
                  onUpdateOpenaiConfig({
                    ...openaiConfig,
                    transcriptionModel: e.target.checked ? "whisper-1" : "gpt-4o-mini-transcribe",
                  })
                }
                disabled={locked}
              />
              <span>Use Whisper even if not listed</span>
            </label>
            <p className="text-xs mt-1 opacity-70">
              Whisper may not appear in the model list; toggle to force VTT subtitles.
            </p>
          </div>
          <div>
            <FieldLabel>Source Language (optional)</FieldLabel>
            <TextInput
              type="text"
              value={openaiConfig.transcriptionLanguage || ""}
              onChange={(e) =>
                onUpdateOpenaiConfig({
                  ...openaiConfig,
                  transcriptionLanguage: e.target.value,
                })
              }
              placeholder="e.g., ja for Japanese"
              disabled={locked}
            />
            <p className="text-xs mt-1 opacity-70">
              ISO-639-1 code. Leave empty for auto-detection.
            </p>
          </div>
        </div>
      )}

      {/* Common settings */}
      <div className={`grid grid-cols-1 gap-4 ${isOpenAI ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div>
          <FieldLabel>Chunk Length</FieldLabel>
          <select
            className={theme.input}
            value={openaiConfig.transcriptionChunkSeconds ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS}
            onChange={(e) =>
              onUpdateOpenaiConfig({
                ...openaiConfig,
                transcriptionChunkSeconds: Number(e.target.value),
              })
            }
            disabled={locked}
          >
            {[60, 120, 180, 240, 300, 600, 900, 1200].map((sec) => (
              <option key={sec} value={sec}>
                {Math.round(sec / 60)} min
              </option>
            ))}
          </select>
          <p className="text-xs mt-1 opacity-70">
            {isGemini
              ? "Max duration per chunk. In sequential mode, model may suggest earlier break points at natural boundaries (scene changes, pauses)."
              : "Duration of each audio segment for OpenAI transcription API."}
          </p>
        </div>
        <div>
          <FieldLabel>{isGemini ? "Break Window" : "Chunk Overlap / Break Window"}</FieldLabel>
          <select
            className={theme.input}
            value={transcriptionOverlapSeconds ?? TRANSCRIPTION_DEFAULT_OVERLAP_SECONDS}
            onChange={(e) =>
              setTranscriptionOverlapSeconds(Math.max(0, Number(e.target.value) || 0))
            }
            disabled={locked}
          >
            {[0, 1, 2, 3, 4, 5, 10, 20, 30].map((ov) => (
              <option key={ov} value={ov}>
                {ov}s
              </option>
            ))}
          </select>
          <p className="text-xs mt-1 opacity-70">
            {isGemini
              ? "Window (in the final seconds of a chunk) where Gemini should pick the next natural break. Also reused as overlap for legacy mode."
              : "Overlap between consecutive chunks for OpenAI. For Gemini sequential mode, this controls the end-of-chunk break window (e.g., last 20s)."}
          </p>
        </div>

        {/* Concurrency (OpenAI only) */}
        {isOpenAI && (
          <div>
            <FieldLabel>Concurrency</FieldLabel>
            <select
              className={theme.input}
              value={openaiConfig.transcriptionConcurrency ?? TRANSCRIPTION_DEFAULT_CONCURRENCY}
              onChange={(e) =>
                onUpdateOpenaiConfig({
                  ...openaiConfig,
                  transcriptionConcurrency: Number(e.target.value),
                })
              }
              disabled={locked}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((c) => (
                <option key={c} value={c}>
                  {c} parallel
                </option>
              ))}
            </select>
            <p className="text-xs mt-1 opacity-70">
              Max parallel OpenAI transcription requests when media is chunked.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
