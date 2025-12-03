import { useEffect, useState } from "react";
import type { ProviderType } from "./providers/types";

export type UsageInfo = {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
};

export type ProviderLogEntry = {
    id: string;
    timestamp: number;
    provider: ProviderType;
    purpose: string;
    model?: string;
    temperature?: number;
    safetyOff?: boolean;
    durationMs?: number;
    status: "ok" | "error";
    message?: string;
    chunkIdx?: number;
    runId?: number;
    tokens?: UsageInfo;
};

type Subscriber = (entries: ProviderLogEntry[]) => void;

const subscribers = new Set<Subscriber>();
const MAX_ENTRIES = 200;
let entries: ProviderLogEntry[] = [];

function notify() {
    const snapshot = entries.slice();
    subscribers.forEach((fn) => fn(snapshot));
}

export function addProviderLog(
    entry: Omit<ProviderLogEntry, "id" | "timestamp"> & {
        id?: string;
        timestamp?: number;
    },
) {
    const next: ProviderLogEntry = {
        id: entry.id || `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: entry.timestamp ?? Date.now(),
        ...entry,
    };
    entries = [next, ...entries].slice(0, MAX_ENTRIES);
    notify();
}

export function clearProviderLog() {
    entries = [];
    notify();
}

export function useProviderLog() {
    const [logEntries, setLogEntries] = useState<ProviderLogEntry[]>(entries);

    useEffect(() => {
        const handler: Subscriber = (list) => setLogEntries(list);
        subscribers.add(handler);
        return () => {
            subscribers.delete(handler);
        };
    }, []);

    return { entries: logEntries, clear: clearProviderLog };
}

// Re-export types for backward compatibility
export type GeminiUsage = UsageInfo;
export type GeminiLogEntry = ProviderLogEntry;
export type GeminiTrace = {
    purpose: string;
    chunkIdx?: number;
    runId?: number;
};

// Re-export functions for backward compatibility
export const addGeminiLog = addProviderLog;
export const clearGeminiLog = clearProviderLog;
export const useGeminiLog = useProviderLog;
