/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Mock provider for testing chunk processing UX flows
 *
 * Purpose: Test start/pause/resume/retry/reset state machine without burning API quota
 * NOT for testing data quality - just returns minimal valid fixtures
 */

// ============================================================================
// Mock Configuration
// ============================================================================

export interface MockChunkConfig {
  chunkId: number;
  delay: number;           // Simulated API latency (ms)
  shouldFail?: boolean;    // Deterministic failure
  errorType?: 'rate_limit' | 'network' | 'invalid_response';
}

export interface MockRunConfig {
  chunks: MockChunkConfig[];
  mode: 'transcription' | 'translation';
}

// ============================================================================
// Mock Fixtures (minimal valid data)
// ============================================================================

const MOCK_TRANSCRIPTION_CUE = {
  start_seconds: 0,
  end_seconds: 5,
  text: "これはモックデータです",
  speaker: "テスト太郎",
  notes: "Mock transcription for testing UI",
  sound_effects: ["笑い声"],
};

const MOCK_TRANSLATION_CUE = {
  ...MOCK_TRANSCRIPTION_CUE,
  english_text: "This is mock data",
  translation_notes: "Mock translation for testing UI",
};

// ============================================================================
// Mock Provider Interface
// ============================================================================

export interface MockProviderOptions {
  chunkId: number;
  config: MockChunkConfig;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Simulates a transcription API call
 * Returns minimal valid JSON after configured delay
 */
export async function mockTranscribe(
  options: MockProviderOptions
): Promise<any> {
  const { chunkId, config, signal, onProgress } = options;

  // Check abort signal before starting
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  // Simulate upload/processing with progress updates
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    onProgress?.(i / steps);
    await sleep(config.delay / steps);
  }

  // Deterministic failures for retry testing
  if (config.shouldFail) {
    throw createMockError(config.errorType || 'rate_limit', chunkId);
  }

  // Return minimal valid structured transcription
  return {
    cues: [
      {
        ...MOCK_TRANSCRIPTION_CUE,
        start_seconds: chunkId * 60,        // Offset by chunk
        end_seconds: chunkId * 60 + 5,
        text: `モックチャンク ${chunkId}`,
      },
    ],
    metadata: {
      language: "ja",
      duration: 5,
      engine: "mock-provider",
    },
  };
}

/**
 * Simulates a translation API call
 * Returns minimal valid JSON after configured delay
 */
export async function mockTranslate(
  options: MockProviderOptions
): Promise<any> {
  const { chunkId, config, signal, onProgress } = options;

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  // Simulate translation processing
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    onProgress?.(i / steps);
    await sleep(config.delay / steps);
  }

  if (config.shouldFail) {
    throw createMockError(config.errorType || 'rate_limit', chunkId);
  }

  return {
    cues: [
      {
        ...MOCK_TRANSLATION_CUE,
        start_seconds: chunkId * 60,
        end_seconds: chunkId * 60 + 5,
        text: `モックチャンク ${chunkId}`,
        english_text: `Mock chunk ${chunkId}`,
      },
    ],
    metadata: {
      source_language: "ja",
      target_language: "en",
      api: "mock-provider",
    },
  };
}

// ============================================================================
// Mock Error Scenarios
// ============================================================================

function createMockError(type: string, chunkId: number): Error {
  switch (type) {
    case 'rate_limit':
      return Object.assign(
        new Error(`[Mock] Rate limit exceeded for chunk ${chunkId}`),
        { status: 429, code: 'RESOURCE_EXHAUSTED' }
      );

    case 'network':
      return Object.assign(
        new Error(`[Mock] Network timeout for chunk ${chunkId}`),
        { status: 0, code: 'NETWORK_ERROR' }
      );

    case 'invalid_response':
      return Object.assign(
        new Error(`[Mock] Invalid response schema for chunk ${chunkId}`),
        { status: 500, code: 'INVALID_SCHEMA' }
      );

    default:
      return new Error(`[Mock] Unknown error for chunk ${chunkId}`);
  }
}

// ============================================================================
// Predefined Mock Scenarios
// ============================================================================

/**
 * Happy path: all chunks succeed with varying latency
 */
export function createHappyPathScenario(numChunks: number): MockRunConfig {
  return {
    mode: 'transcription',
    chunks: Array.from({ length: numChunks }, (_, i) => ({
      chunkId: i,
      delay: 500 + Math.random() * 1000, // 500-1500ms
    })),
  };
}

/**
 * Retry scenario: chunk 2 always fails first time, succeeds on retry
 */
export function createRetryScenario(numChunks: number): MockRunConfig {
  const chunks: MockChunkConfig[] = [];
  let chunk2HasFailed = false;

  return {
    mode: 'transcription',
    chunks: Array.from({ length: numChunks }, (_, i) => {
      const config: MockChunkConfig = {
        chunkId: i,
        delay: 800,
      };

      // Chunk 2 fails the first time, succeeds on retry
      if (i === 2 && !chunk2HasFailed) {
        config.shouldFail = true;
        config.errorType = 'rate_limit';
        chunk2HasFailed = true;
      }

      return config;
    }),
  };
}

/**
 * Multi-failure scenario: multiple chunks fail with different errors
 */
export function createMultiFailureScenario(numChunks: number): MockRunConfig {
  return {
    mode: 'transcription',
    chunks: Array.from({ length: numChunks }, (_, i) => ({
      chunkId: i,
      delay: 700,
      shouldFail: i === 1 || i === 3,
      errorType: i === 1 ? 'rate_limit' : 'network',
    })),
  };
}

/**
 * Slow processing scenario: test pause/resume with long delays
 */
export function createSlowProcessingScenario(numChunks: number): MockRunConfig {
  return {
    mode: 'transcription',
    chunks: Array.from({ length: numChunks }, (_, i) => ({
      chunkId: i,
      delay: 3000, // 3 seconds per chunk
    })),
  };
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  // Dev environment
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === '1') {
    return true;
  }

  // Production query param
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('mock') === '1';
  }

  return false;
}

/**
 * Get active mock scenario
 */
export function getActiveMockScenario(): MockRunConfig | null {
  if (!isMockMode()) return null;

  // Default to happy path with 4 chunks
  const scenario = import.meta.env.VITE_MOCK_SCENARIO || 'happy';

  switch (scenario) {
    case 'happy':
      return createHappyPathScenario(4);
    case 'retry':
      return createRetryScenario(4);
    case 'multi-fail':
      return createMultiFailureScenario(5);
    case 'slow':
      return createSlowProcessingScenario(3);
    default:
      return createHappyPathScenario(4);
  }
}
