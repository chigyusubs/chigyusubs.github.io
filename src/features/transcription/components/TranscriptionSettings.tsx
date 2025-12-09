import React from "react";
import { FieldLabel } from "../../../components/ui/Field";
import { useTheme } from "../../../lib/themeContext";
import {
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
  locked: boolean;
  openaiConfig: OpenAIConfig;
  onUpdateOpenaiConfig: (config: OpenAIConfig) => void;
  transcriptionOverlapSeconds: number;
  setTranscriptionOverlapSeconds: (seconds: number) => void;
};

export function TranscriptionSettings({
  locked,
  openaiConfig,
  onUpdateOpenaiConfig,
  transcriptionOverlapSeconds,
  setTranscriptionOverlapSeconds,
}: Props) {
  const theme = useTheme();

  return (
    <div className="space-y-4">
      {/* Gemini settings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            Max duration per chunk. Sequential mode may suggest earlier breaks; 2 minutes recommended to avoid looping.
          </p>
        </div>
        <div>
          <FieldLabel>Break Window</FieldLabel>
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
            Window (in the final seconds of a chunk) where Gemini should pick the next natural break. Also reused as overlap for legacy mode.
          </p>
        </div>
      </div>
    </div>
  );
}
