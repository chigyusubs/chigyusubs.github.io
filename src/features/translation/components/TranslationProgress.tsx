import React from "react";
import { TranslateResult } from "../../../lib/translation";
import { SectionCard } from "../../../components/ui/SectionCard";
import { useTheme } from "../../../lib/themeContext";
import { useRateLimitWait } from "../../../lib/rateLimit";

type Props = {
  progress: string;
  result: TranslateResult | null;
};

export function TranslationProgress({ progress, result }: Props) {
  const theme = useTheme();
  const rateLimit = useRateLimitWait();
  if (!progress && !result) return null;
  const chunkProgress = result
    ? {
        completed: result.chunks.filter(
          (c) => c.status === "ok",
        ).length,
        total: result.chunks.length,
      }
    : { completed: 0, total: 0 };

  const pct =
    chunkProgress.total > 0
      ? (chunkProgress.completed / chunkProgress.total) * 100
      : 0;
  const widthClass = `w-[${Math.max(0, Math.min(100, Math.round(pct)))}%]`;

  return (
    <SectionCard title="Progress">
      <div className={`h-4 rounded overflow-hidden ${theme.progressTrack}`}>
        <div
          className={`h-full transition-all duration-300 ${theme.progressBar} ${widthClass}`}
        />
      </div>
      <div className={`flex justify-between text-xs mt-1 ${theme.mutedText}`}>
        <span>
          Chunks: {chunkProgress.completed}/{chunkProgress.total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      {rateLimit.isWaiting && (
        <div className={`mt-2 text-xs px-3 py-2 rounded ${theme.cardBorder}`}>
          Rate limit hit. Retrying in ~
          {Math.max(1, Math.ceil(rateLimit.remainingMs / 1000))}s
        </div>
      )}
    </SectionCard>
  );
}
