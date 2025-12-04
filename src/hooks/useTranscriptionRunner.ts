import { useState } from "react";
import type { TranslateResult, ChunkStatus } from "../lib/translation";

export function useTranscriptionRunner() {
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const reset = () => {
    setProgress("");
    setResult(null);
    setPaused(false);
    setIsRunning(false);
  };

  const startRun = () => {
    setIsRunning(true);
    setPaused(false);
    setProgress("");
    setResult(null);
  };

  const finishRun = () => {
    setIsRunning(false);
    setPaused(false);
  };

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  const updateChunks = (chunks: ChunkStatus[], warnings: string[] = []) => {
    setResult((prev) => ({
      ok: chunks.every((c) => c.status === "ok"),
      warnings,
      chunks: chunks.sort((a, b) => a.idx - b.idx),
      vtt: prev?.vtt || "",
      srt: prev?.srt || "",
      video_ref: prev?.video_ref ?? null,
    }));
  };

  return {
    state: { progress, result, paused, isRunning },
    actions: {
      setProgress,
      setResult,
      reset,
      startRun,
      finishRun,
      pause,
      resume,
      updateChunks,
    },
  };
}
