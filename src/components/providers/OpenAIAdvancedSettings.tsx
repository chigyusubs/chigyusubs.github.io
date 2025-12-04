import React from "react";
import { FieldLabel, TextInput } from "../ui/Field";
import {
    TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
    TRANSCRIPTION_DEFAULT_CONCURRENCY,
    TRANSCRIPTION_MAX_CONCURRENCY,
    TRANSCRIPTION_MIN_CHUNK_SECONDS,
    TRANSCRIPTION_MIN_CONCURRENCY,
} from "../../config/defaults";
import { useTheme } from "../../lib/themeContext";

type OpenAIConfig = {
    transcriptionEnabled: boolean;
    transcriptionModel?: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
    transcriptionLanguage?: string;
    transcriptionConcurrency?: number;
    transcriptionChunkSeconds?: number;
};

type Props = {
    config: OpenAIConfig;
    onChange: (config: OpenAIConfig) => void;
    locked?: boolean;
};

export function OpenAIAdvancedSettings({ config, onChange, locked = false }: Props) {
    const theme = useTheme();

    return (
        <div className="space-y-4 mt-4 pt-4 border-t" style={{ borderColor: theme.borderColor }}>
            <h4 className="font-semibold text-sm">OpenAI Audio Features</h4>

            {/* Audio Transcription */}
            <label className="inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={config.transcriptionEnabled}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            transcriptionEnabled: e.target.checked,
                        })
                    }
                    disabled={locked}
                />
                <span>Use Audio API for transcription</span>
            </label>
            <p className={theme.helperText}>
                Upload audio/video to generate VTT subtitles, then translate with Chat API.
            </p>

            {config.transcriptionEnabled && (
                <div className="ml-6 space-y-3">
                    {/* Model selector */}
                    <div className="space-y-2">
                        <FieldLabel>Transcription Model</FieldLabel>
                        <select
                            className={theme.input}
                            value={config.transcriptionModel || "gpt-4o-mini-transcribe"}
                            onChange={(e) =>
                                onChange({
                                    ...config,
                                    transcriptionModel: e.target.value as "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe",
                                })
                            }
                            disabled={locked}
                        >
                            <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (Fast Text Context - No Subtitles)</option>
                            <option value="gpt-4o-transcribe">gpt-4o-transcribe (High Quality Text - No Subtitles)</option>
                            <option value="whisper-1">whisper-1 (VTT Subtitles - Slow)</option>
                        </select>
                        <p className={theme.helperText}>
                            Use <strong>whisper-1</strong> for subtitles (VTT). Use <strong>gpt-4o</strong> models for fast text context/summary.
                        </p>
                    </div>

                    {/* Language hint (optional) */}
                    <div className="space-y-2">
                        <FieldLabel>Source Language (optional)</FieldLabel>
                        <TextInput
                            type="text"
                            value={config.transcriptionLanguage || ""}
                            onChange={(e) =>
                                onChange({
                                    ...config,
                                    transcriptionLanguage: e.target.value,
                                })
                            }
                            placeholder="e.g., ja for Japanese"
                            disabled={locked}
                        />
                        <p className={theme.helperText}>
                            ISO-639-1 code. Leave empty for auto-detection.
                        </p>
                    </div>

                    {/* Concurrency */}
                    <div className="space-y-2">
                        <FieldLabel>Chunk Concurrency</FieldLabel>
                        <TextInput
                            type="number"
                            min={TRANSCRIPTION_MIN_CONCURRENCY}
                            max={TRANSCRIPTION_MAX_CONCURRENCY}
                            value={config.transcriptionConcurrency ?? TRANSCRIPTION_DEFAULT_CONCURRENCY}
                            onChange={(e) =>
                                onChange({
                                    ...config,
                                    transcriptionConcurrency: Math.min(
                                        TRANSCRIPTION_MAX_CONCURRENCY,
                                        Math.max(
                                            TRANSCRIPTION_MIN_CONCURRENCY,
                                            Number(e.target.value) || TRANSCRIPTION_DEFAULT_CONCURRENCY,
                                        ),
                                    ),
                                })
                            }
                            disabled={locked}
                        />
                        <p className={theme.helperText}>
                            Max parallel OpenAI transcription requests when media is chunked (keep low to avoid rate limits).
                        </p>
                    </div>

                    {/* Chunk length */}
                    <div className="space-y-2">
                        <FieldLabel>Chunk Length (seconds)</FieldLabel>
                        <TextInput
                            type="number"
                            min={TRANSCRIPTION_MIN_CHUNK_SECONDS}
                            value={config.transcriptionChunkSeconds ?? TRANSCRIPTION_DEFAULT_CHUNK_SECONDS}
                            onChange={(e) =>
                                onChange({
                                    ...config,
                                    transcriptionChunkSeconds: Math.max(
                                        TRANSCRIPTION_MIN_CHUNK_SECONDS,
                                        Number(e.target.value) || TRANSCRIPTION_DEFAULT_CHUNK_SECONDS,
                                    ),
                                })
                            }
                            disabled={locked}
                        />
                        <p className={theme.helperText}>
                            Split long media for OpenAI transcription. 4o models work best under ~1200s; Whisper-1 has no strict limit.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
