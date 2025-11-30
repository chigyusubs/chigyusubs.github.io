export type CustomPreset = {
    id: string;
    name: string;
    description?: string;
    systemText: string;
    systemVideo: string;
    systemAudio: string;
    summary: string;
    glossary: string;
};

export type PresetExportFormat = {
    version: string;
    presets: CustomPreset[];
};

export function validatePreset(preset: unknown): preset is CustomPreset {
    if (typeof preset !== 'object' || preset === null) return false;
    const p = preset as Record<string, unknown>;

    return (
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.systemText === 'string' &&
        typeof p.systemVideo === 'string' &&
        typeof p.systemAudio === 'string' &&
        typeof p.summary === 'string' &&
        typeof p.glossary === 'string'
    );
}

export function validatePresetExport(data: unknown): data is PresetExportFormat {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;

    if (typeof d.version !== 'string') return false;
    if (!Array.isArray(d.presets)) return false;

    return d.presets.every(validatePreset);
}

export function exportPresets(presets: CustomPreset[]): string {
    const exportData: PresetExportFormat = {
        version: '1.0',
        presets,
    };
    return JSON.stringify(exportData, null, 2);
}

export function importPresets(jsonString: string): CustomPreset[] {
    try {
        const data = JSON.parse(jsonString);
        if (!validatePresetExport(data)) {
            throw new Error('Invalid preset format');
        }
        return data.presets;
    } catch (err) {
        throw new Error(
            err instanceof Error ? err.message : 'Failed to parse preset JSON'
        );
    }
}

export function downloadPresetFile(presets: CustomPreset[], filename = 'chigyusubs-presets.json') {
    const json = exportPresets(presets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function createPresetFromCurrent(
    id: string,
    name: string,
    systemText: string,
    systemVideo: string,
    systemAudio: string,
    summary: string,
    glossary: string,
    description?: string
): CustomPreset {
    return {
        id,
        name,
        description,
        systemText,
        systemVideo,
        systemAudio,
        summary,
        glossary,
    };
}
