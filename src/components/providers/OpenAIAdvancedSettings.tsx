import React from "react";
import { FieldLabel, TextInput } from "../ui/Field";
import { useTheme } from "../../lib/themeContext";

type OpenAIConfig = {
    transcriptionEnabled: boolean;
    transcriptionModel?: "whisper-1";
    transcriptionLanguage?: string;
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
                            value={config.transcriptionModel || "whisper-1"}
                            onChange={(e) =>
                                onChange({
                                    ...config,
                                    transcriptionModel: e.target.value as "whisper-1",
                                })
                            }
                            disabled={locked}
                        >
                            <option value="whisper-1">whisper-1 (VTT output)</option>
                            {/* Future: GPT-4o models when VTT conversion is implemented */}
                        </select>
                        <p className={theme.helperText}>
                            whisper-1 is currently the only model that outputs VTT format directly.
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
                </div>
            )}
        </div>
    );
}
