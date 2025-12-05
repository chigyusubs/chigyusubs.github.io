# Refactor status (translation vs transcription)

## Recent changes
- Fixed runtime ReferenceErrors (missing defaults, preset state) to restore UI.
- Centralized preset handling in `src/features/translation/hooks/useTranslationWorkflowImpl.ts` (custom presets load/save from `localStorage`, expose state/actions to the UI).
- Simplified the main runner by delegating preset actions/state to the translation workflow hook; removed unused imports. Build passes.

## Goals (in progress)
- Clean separation: translation and transcription have their own runners/workflows; shared code only where sensible (media upload helper, provider state).
- Reduce runner size: keep `useTranslationWorkflowRunner` thin and defer translation logic to the translation workflow hook.
- Organize UI: move translation progress/results into `src/features/translation/components` and bind directly to translation state (mirroring transcription components).

## Next steps
1) Move translation submit/retry/prompt wiring out of `useTranslationWorkflowRunner` into the translation workflow hook.
2) Relocate translation progress/result components under `src/features/translation/components` and wire them to translation state/actions.
3) Extract shared media upload/inline handling into a helper used by both workflows; centralize provider config types in `useProviderState`.
4) Optional: add a small error boundary/debug toggle to surface runtime errors in-app (friendly banner, copy details).

## Current status
- `npm run build` passes.
- UI loads after preset import fix; no known runtime errors.
