import { useTranscription } from "../features/transcription";

/**
 * Thin wrapper around the transcription feature to expose runner-like state/actions.
 * Keeps transcription concerns separate from the translation workflow runner.
 */
export function useTranscriptionWorkflowRunner() {
  const feature = useTranscription();

  return {
    state: {
      progress: feature.state.progress,
      result: feature.state.result,
      isRunning: feature.state.isRunning,
      isPaused: feature.state.isPaused,
      error: feature.state.error,
    },
    actions: {
      start: feature.actions.start,
      pause: feature.actions.pause,
      resume: feature.actions.resume,
      cancel: feature.actions.cancel,
      reset: feature.actions.reset,
      retryChunk: feature.actions.retryChunk,
    },
  };
}
