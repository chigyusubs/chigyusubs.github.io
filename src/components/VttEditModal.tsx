import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { useTheme } from "../lib/themeContext";
import { parseVtt } from "../lib/vtt";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string) => void;
    initialContent: string;
    chunkIdx: number;
};

export function VttEditModal({
    isOpen,
    onClose,
    onSave,
    initialContent,
    chunkIdx,
}: Props) {
    const theme = useTheme();
    const [content, setContent] = useState(initialContent);
    const [validationError, setValidationError] = useState("");

    useEffect(() => {
        setContent(initialContent);
        setValidationError("");
    }, [initialContent, isOpen]);

    const handleSave = () => {
        const validateCueIntegrity = (cues: ReturnType<typeof parseVtt>): string | null => {
            for (let i = 0; i < cues.length; i += 1) {
                const cue = cues[i];
                if (cue.end <= cue.start) {
                    return `Cue ${i + 1} ends before it starts`;
                }
                if (i > 0 && cue.start < cues[i - 1].end) {
                    return `Cue ${i + 1} overlaps the previous cue`;
                }
            }
            return null;
        };

        // Validate VTT format and basic time integrity
        try {
            const cues = parseVtt(content);
            const integrityError = validateCueIntegrity(cues);
            if (integrityError) {
                setValidationError(integrityError);
                return;
            }
            setValidationError("");
            onSave(content);
            onClose();
        } catch (err) {
            setValidationError(
                err instanceof Error ? err.message : "Invalid VTT format"
            );
        }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        // Clear validation error when user starts editing
        if (validationError) {
            setValidationError("");
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col border"
                onClick={(e) => e.stopPropagation()}
                style={{
                    borderColor: theme.borderColor,
                }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b" style={{ borderColor: theme.borderColor }}>
                    <h2 className="text-xl font-semibold" style={{ color: theme.text }}>
                        Edit VTT Content - Chunk {chunkIdx}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: theme.mutedText }}>
                        Edit the VTT content below. Ensure proper VTT format with timecodes.
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <textarea
                        value={content}
                        onChange={handleContentChange}
                        className="w-full h-96 p-3 rounded border font-mono text-sm resize-y"
                        style={{
                            backgroundColor: theme.codeBackground,
                            borderColor: validationError ? "#ef4444" : theme.borderColor,
                            color: theme.text,
                        }}
                        spellCheck={false}
                    />

                    {validationError && (
                        <div
                            className="mt-2 p-3 rounded text-sm"
                            style={{
                                backgroundColor: "#fef2f2",
                                color: "#991b1b",
                                borderColor: "#fecaca",
                            }}
                        >
                            <strong>Validation Error:</strong> {validationError}
                        </div>
                    )}

                    <div className="mt-3 text-xs" style={{ color: theme.mutedText }}>
                        <strong>VTT Format Example:</strong>
                        <pre
                            className="mt-1 p-2 rounded"
                            style={{
                                backgroundColor: theme.codeBackground,
                                borderColor: theme.borderColor,
                            }}
                        >
                            {`00:00:01.000 --> 00:00:03.000
Translated subtitle text here

00:00:03.500 --> 00:00:05.000
Next subtitle line`}
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="px-6 py-4 border-t flex justify-end gap-3"
                    style={{ borderColor: theme.borderColor }}
                >
                    <Button tone="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button tone="primary" onClick={handleSave}>
                        Save & Set OK
                    </Button>
                </div>
            </div>
        </div>
    );
}
