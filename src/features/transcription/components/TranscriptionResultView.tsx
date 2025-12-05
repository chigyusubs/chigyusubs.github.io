import React from "react";
import type { TranscriptionResult, TranscriptionChunk } from "../types";
import { Button } from "../../../components/ui/Button";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useTheme } from "../../../lib/themeContext";

type Props = {
  result: TranscriptionResult | null;
  onRetryChunk?: (chunk: TranscriptionChunk) => void;
};

function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [hrs, mins, secs]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
  return parts;
}

export function TranscriptionResultView({ result, onRetryChunk }: Props) {
  const theme = useTheme();

  if (!result) return null;

  return (
    <SectionCard title="Results">
      <div className="flex gap-2 mb-4">
        <Button
          tone="primary"
          onClick={() => downloadText("transcription.vtt", result.vtt)}
          disabled={!result.vtt}
        >
          Download VTT
        </Button>
        <Button
          tone="primary"
          onClick={() => downloadText("transcription.srt", result.srt)}
          disabled={!result.srt}
        >
          Download SRT
        </Button>
      </div>

      {result.warnings.length > 0 && (
        <div className={`mb-4 p-3 rounded text-sm ${theme.well.warning}`}>
          <h3 className="font-bold mb-1">Warnings:</h3>
          <ul className="list-disc list-inside">
            {result.warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {result.warnings.length > 5 && (
              <li>...and {result.warnings.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Chunks</h3>
        {result.chunks.map((chunk) => (
          <div
            key={chunk.idx}
            className={`p-2 rounded border text-sm ${chunk.status === "ok"
              ? theme.statusCard.ok
              : chunk.status === "failed"
                ? theme.statusCard.failed
                : theme.statusCard.neutral
              }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">
                Chunk {chunk.idx} ({formatTime(chunk.timeRange.start)} -{" "}
                {formatTime(chunk.timeRange.end)})
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${chunk.status === "ok"
                    ? theme.badge.ok
                    : chunk.status === "failed"
                      ? theme.badge.error
                      : theme.badge.neutral
                    }`}
                >
                  {chunk.status}
                </span>
                {(chunk.model_name ||
                  chunk.temperature !== undefined ||
                  chunk.duration_ms !== undefined) && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                      {chunk.model_name && <span>{chunk.model_name}</span>}
                      {chunk.temperature !== undefined && (
                        <span>· temp {chunk.temperature}</span>
                      )}
                      {chunk.duration_ms !== undefined && (
                        <span>
                          · {Math.max(chunk.duration_ms / 1000, 0).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                {chunk.status === "failed" && onRetryChunk && (
                  <Button
                    className="text-xs px-2 py-1"
                    tone="secondary"
                    onClick={() => onRetryChunk(chunk)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
            {chunk.warnings.length > 0 && (
              <div className={`mt-1 text-xs ${theme.warningText}`}>
                {chunk.warnings.map((w, i) => (
                  <div key={i}>⚠️ {w}</div>
                ))}
              </div>
            )}
            <details className="mt-2">
              <summary className={`cursor-pointer text-xs ${theme.mutedText}`}>
                Show details
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-sm font-semibold">Prompt Sent:</p>
                  <pre
                    className="p-2 rounded border text-base whitespace-pre-wrap max-h-40 overflow-y-auto"
                    style={{
                      backgroundColor: theme.codeBackground,
                      borderColor: theme.borderColor,
                    }}
                  >
                    {chunk.prompt || "(no prompt recorded)"}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-semibold">Raw Model Output:</p>
                  <pre
                    className="p-2 rounded border text-base whitespace-pre-wrap max-h-40 overflow-y-auto"
                    style={{
                      backgroundColor: theme.codeBackground,
                      borderColor: theme.borderColor,
                    }}
                  >
                    {chunk.raw_model_output || "(no output)"}
                  </pre>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-semibold">Parsed VTT:</p>
                  </div>
                  <pre
                    className="p-2 rounded border text-base whitespace-pre-wrap max-h-40 overflow-y-auto"
                    style={{
                      backgroundColor: theme.codeBackground,
                      borderColor: theme.borderColor,
                      color: theme.text,
                    }}
                  >
                    {chunk.vtt || chunk.raw_model_output || "(no output)"}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
