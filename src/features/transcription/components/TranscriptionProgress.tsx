import React from "react";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useTheme } from "../../../lib/themeContext";
import type { TranscriptionResult } from "../types";

type Props = {
  progress: string;
  result: TranscriptionResult | null;
};

export function TranscriptionProgress({ progress, result }: Props) {
  const theme = useTheme();

  if (!progress && !result) return null;

  const chunkProgress = result
    ? {
        completed: result.chunks.filter(
          (c) => c.status === "ok" || c.status === "failed"
        ).length,
        total: result.chunks.length,
      }
    : { completed: 0, total: 0 };

  const pct =
    chunkProgress.total > 0
      ? (chunkProgress.completed / chunkProgress.total) * 100
      : 0;

  return (
    <SectionCard title="Progress">
      <div className={`h-4 rounded overflow-hidden ${theme.progressTrack}`}>
        <div
          className={`h-full transition-all duration-300 ${theme.progressBar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`flex justify-between text-xs mt-1 ${theme.mutedText}`}>
        <span>
          Chunks: {chunkProgress.completed}/{chunkProgress.total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      {progress && (
        <p className={`text-xs mt-2 ${theme.mutedText}`}>{progress}</p>
      )}
    </SectionCard>
  );
}
