import React from "react";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useTheme } from "../../../lib/themeContext";
import type { TranscriptionResult } from "../types";

type Props = {
  progress: string;
  result: TranscriptionResult | null;
  chunkLengthSeconds?: number;
};

export function TranscriptionProgress({ progress, result, chunkLengthSeconds = 600 }: Props) {
  const theme = useTheme();

  if (!progress && !result) return null;

  // Calculate expected total chunks from cursor when resuming
  const getExpectedTotal = (): number => {
    if (!result) return 0;
    // If we have a cursor with video duration, calculate expected total
    if (result.cursor?.videoDuration && chunkLengthSeconds > 0) {
      return Math.ceil(result.cursor.videoDuration / chunkLengthSeconds);
    }
    // Otherwise use chunk count (normal run or completed)
    return result.chunks.length;
  };

  const chunkProgress = result
    ? {
        completed: result.chunks.filter(
          (c) => c.status === "ok"
        ).length,
        total: getExpectedTotal(),
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
