import { useMemo } from "react";
import type { PromptPresetId } from "../../../config/defaults";
import { DEFAULT_SYSTEM_PROMPT_TEXT, PROMPT_PRESETS } from "../../../config/defaults";
import type { CustomPreset } from "../../../lib/presetImportExport";

type Props = {
  currentPreset: PromptPresetId | "";
  customPrompt: string;
  customPresets?: CustomPreset[];
};

export function useMemoizedPresetPrompt({
  currentPreset,
  customPrompt,
  customPresets = [],
}: Props) {
  const presetPrompt = useMemo(() => {
    if (currentPreset && currentPreset in PROMPT_PRESETS) {
      return PROMPT_PRESETS[currentPreset as PromptPresetId].systemPrompt;
    }
    const custom = customPresets.find((p) => p.id === currentPreset);
    if (custom) return custom.systemPrompt;
    return DEFAULT_SYSTEM_PROMPT_TEXT;
  }, [currentPreset, customPresets]);

  return {
    prompt: customPrompt || presetPrompt,
    presetPrompt,
  };
}
