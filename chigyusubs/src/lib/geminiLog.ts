import { useEffect, useState } from "react";

export type GeminiUsage = {
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
};

export type GeminiLogEntry = {
  id: string;
  timestamp: number;
  purpose: string;
  model?: string;
  temperature?: number;
  safetyOff?: boolean;
  durationMs?: number;
  status: "ok" | "error";
  message?: string;
  chunkIdx?: number;
  runId?: number;
  tokens?: GeminiUsage;
};

type Subscriber = (entries: GeminiLogEntry[]) => void;

const subscribers = new Set<Subscriber>();
const MAX_ENTRIES = 200;
let entries: GeminiLogEntry[] = [];

function notify() {
  const snapshot = entries.slice();
  subscribers.forEach((fn) => fn(snapshot));
}

export function addGeminiLog(
  entry: Omit<GeminiLogEntry, "id" | "timestamp"> & {
    id?: string;
    timestamp?: number;
  },
) {
  const next: GeminiLogEntry = {
    id: entry.id || `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: entry.timestamp ?? Date.now(),
    ...entry,
  };
  entries = [next, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

export function clearGeminiLog() {
  entries = [];
  notify();
}

export function useGeminiLog() {
  const [logEntries, setLogEntries] = useState<GeminiLogEntry[]>(entries);

  useEffect(() => {
    const handler: Subscriber = (list) => setLogEntries(list);
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, []);

  return { entries: logEntries, clear: clearGeminiLog };
}

export type GeminiTrace = {
  purpose: string;
  chunkIdx?: number;
  runId?: number;
};
