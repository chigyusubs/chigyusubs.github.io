import React, { useMemo, useState } from "react";
import { useProviderLog } from "../lib/providerLog";
import type { ProviderType } from "../lib/providers/types";
import { useTheme, useThemeControl } from "../lib/themeContext";
import { copyDebugBuffer } from "../lib/debugState";
import { Button } from "./ui/Button";
import { SectionCard } from "./ui/SectionCard";
import { isDebugEnabled } from "../lib/debugToggle";

function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString();
}

function formatTokens(tokens?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
}) {
    if (!tokens) return "—";
    const parts: string[] = [];
    if (typeof tokens.totalTokens === "number")
        parts.push(`tot ${tokens.totalTokens}`);
    if (typeof tokens.promptTokens === "number")
        parts.push(`in ${tokens.promptTokens}`);
    if (typeof tokens.responseTokens === "number")
        parts.push(`out ${tokens.responseTokens}`);
    return parts.length ? parts.join(" / ") : "—";
}

function formatDurationMs(ms?: number) {
    if (typeof ms !== "number" || Number.isNaN(ms)) return "—";
    return `${(ms / 1000).toFixed(1)}s`;
}

const providerColors: Record<
    ProviderType,
    { bg: string; text: string; badge: string }
> = {
    gemini: { bg: "bg-blue-100", text: "text-blue-800", badge: "GEM" },
    openai: { bg: "bg-green-100", text: "text-green-800", badge: "OAI" },
    anthropic: { bg: "bg-purple-100", text: "text-purple-800", badge: "ANT" },
    ollama: { bg: "bg-orange-100", text: "text-orange-800", badge: "OLL" },
};

export function ProviderDebugLog() {
    const { entries, clear } = useProviderLog();
    const [open, setOpen] = useState(false);
    const theme = useTheme();
    const { name: themeName } = useThemeControl();
    const isDark = themeName === "dark";
    const debugOn = isDebugEnabled();

    const copyEvents = async () => {
        const text = copyDebugBuffer();
        if (!text || !text.trim()) {
            alert("No internal events logged yet.");
            return;
        }
        if (navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                alert("Internal events copied");
                return;
            } catch {
                // fall back
            }
        }
        // fallback textarea copy
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            alert("Internal events copied");
        } catch {
            alert(text);
        } finally {
            document.body.removeChild(textarea);
        }
    };

    const latest = useMemo(() => entries.slice(0, 30), [entries]);

    const tableHeaderClass = isDark
        ? "bg-stone-950 text-stone-100"
        : "bg-orange-50/50 text-orange-800";
    const rowClasses = isDark
        ? "border-t border-stone-900 bg-stone-950 text-stone-100 odd:bg-stone-900"
        : "border-t border-orange-100 bg-orange-50 text-orange-900 odd:bg-orange-100";

    return (
        <SectionCard
            title="Debug log"
            subtitle="API calls in this session (not persisted; keys and prompts are never logged)."
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Button tone="secondary" onClick={() => setOpen((o) => !o)}>
                        {open ? "Hide log" : "Show log"} ({entries.length})
                    </Button>
                    {debugOn && (
                        <Button tone="secondary" onClick={copyEvents}>
                            Copy internal events
                        </Button>
                    )}
                </div>
                <Button tone="secondary" onClick={clear} disabled={!entries.length}>
                    Clear
                </Button>
            </div>
            {open && (
                <div
                    className="overflow-x-auto border rounded"
                    style={{ borderColor: theme.borderColor }}
                >
                    <table
                        className={`min-w-full text-sm ${isDark ? "text-stone-100" : "text-orange-900"}`}
                    >
                        <thead className={tableHeaderClass}>
                            <tr>
                                <th className="px-3 py-2 text-left">Time</th>
                                <th className="px-3 py-2 text-left">Provider</th>
                                <th className="px-3 py-2 text-left">Purpose</th>
                                <th className="px-3 py-2 text-left">Run</th>
                                <th className="px-3 py-2 text-left">Model</th>
                                <th className="px-3 py-2 text-left">Temp</th>
                                <th className="px-3 py-2 text-left">Safety</th>
                                <th className="px-3 py-2 text-left">Tokens</th>
                                <th className="px-3 py-2 text-left">Duration</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {latest.map((entry) => {
                                const providerStyle = providerColors[entry.provider];
                                return (
                                    <tr key={entry.id} className={rowClasses}>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatTime(entry.timestamp)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span
                                                className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${providerStyle.bg} ${providerStyle.text}`}
                                            >
                                                {providerStyle.badge}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {entry.purpose}
                                            {typeof entry.chunkIdx === "number"
                                                ? ` #${entry.chunkIdx}`
                                                : ""}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {entry.runId ?? "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {entry.model || "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {typeof entry.temperature === "number"
                                                ? entry.temperature
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {entry.safetyOff ? "Off" : "On"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatTokens(entry.tokens)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatDurationMs(entry.durationMs)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span
                                                className={
                                                    entry.status === "ok"
                                                        ? theme.successText
                                                        : theme.dangerText
                                                }
                                            >
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-pre-wrap">
                                            {entry.message || "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!latest.length && (
                                <tr>
                                    <td className="px-3 py-3 text-sm" colSpan={11}>
                                        No API calls yet in this session.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionCard>
    );
}

// Re-export for backward compatibility
export { ProviderDebugLog as GeminiDebugLog };
