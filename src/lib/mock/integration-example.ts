/**
 * Example: How to integrate mock provider with existing translation runner
 *
 * This shows how to wrap real API calls with mock alternatives when testing UX flows
 */

import {
  mockTranscribe,
  mockTranslate,
  isMockMode,
  getActiveMockScenario,
  type MockChunkConfig,
} from './provider';

// ============================================================================
// Mock-aware API wrapper
// ============================================================================

interface TranscribeChunkOptions {
  videoUri: string;
  chunkIdx: number;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Transcribe a single chunk - uses mock in demo mode, real API otherwise
 */
export async function transcribeChunk(
  options: TranscribeChunkOptions
): Promise<any> {
  const mockScenario = getActiveMockScenario();

  if (mockScenario && mockScenario.mode === 'transcription') {
    // Mock mode: use predefined scenario
    const chunkConfig = mockScenario.chunks.find(
      c => c.chunkId === options.chunkIdx
    );

    if (!chunkConfig) {
      // Fallback if chunk not in scenario
      return mockTranscribe({
        chunkId: options.chunkIdx,
        config: { chunkId: options.chunkIdx, delay: 800 },
        signal: options.signal,
        onProgress: options.onProgress,
      });
    }

    return mockTranscribe({
      chunkId: options.chunkIdx,
      config: chunkConfig,
      signal: options.signal,
      onProgress: options.onProgress,
    });
  }

  // Real mode: call actual Gemini API
  return transcribeChunkReal(options);
}

interface TranslateChunkOptions {
  chunkVtt: string;
  chunkIdx: number;
  provider: string;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Translate a single chunk - uses mock in demo mode, real API otherwise
 */
export async function translateChunk(
  options: TranslateChunkOptions
): Promise<any> {
  const mockScenario = getActiveMockScenario();

  if (mockScenario && mockScenario.mode === 'translation') {
    const chunkConfig = mockScenario.chunks.find(
      c => c.chunkId === options.chunkIdx
    );

    if (!chunkConfig) {
      return mockTranslate({
        chunkId: options.chunkIdx,
        config: { chunkId: options.chunkIdx, delay: 800 },
        signal: options.signal,
        onProgress: options.onProgress,
      });
    }

    return mockTranslate({
      chunkId: options.chunkIdx,
      config: chunkConfig,
      signal: options.signal,
      onProgress: options.onProgress,
    });
  }

  // Real mode: call actual translation API
  return translateChunkReal(options);
}

// ============================================================================
// Real API implementations (placeholder - replace with actual code)
// ============================================================================

async function transcribeChunkReal(
  options: TranscribeChunkOptions
): Promise<any> {
  // TODO: Implement real Gemini transcription
  throw new Error('Real transcription not yet implemented');
}

async function translateChunkReal(
  options: TranslateChunkOptions
): Promise<any> {
  // TODO: Implement real translation
  throw new Error('Real translation not yet implemented');
}

// ============================================================================
// Usage in UI components
// ============================================================================

/**
 * Example: How to use in a React component
 */
export function ExampleUsageInComponent() {
  const mockEnabled = isMockMode();
  const scenario = getActiveMockScenario();

  return `
    Mock mode: ${mockEnabled ? 'ON' : 'OFF'}
    Scenario: ${scenario ? JSON.stringify(scenario, null, 2) : 'none'}

    To enable:
    - Dev: VITE_MOCK=1 VITE_MOCK_SCENARIO=retry npm run dev
    - Prod: https://app.example.com?mock=1

    Available scenarios:
    - happy (default): All chunks succeed
    - retry: Chunk 2 fails once, then succeeds
    - multi-fail: Multiple chunks fail with different errors
    - slow: 3-second delays for testing pause/resume
  `;
}

// ============================================================================
// CLI script integration
// ============================================================================

/**
 * Example: How to add --mock flag to test scripts
 */
export function parseCliMockFlag(): MockChunkConfig[] | null {
  const args = process.argv.slice(2);
  const mockFlagIndex = args.indexOf('--mock');

  if (mockFlagIndex === -1) return null;

  // Check if specific scenario provided
  const scenarioArg = args[mockFlagIndex + 1];
  const scenario = scenarioArg?.startsWith('--') ? 'happy' : scenarioArg;

  const mockScenario = getMockScenarioByName(scenario || 'happy');
  return mockScenario?.chunks || null;
}

function getMockScenarioByName(name: string): any {
  // Import scenario creators
  const {
    createHappyPathScenario,
    createRetryScenario,
    createMultiFailureScenario,
    createSlowProcessingScenario,
  } = require('./provider');

  switch (name) {
    case 'happy': return createHappyPathScenario(4);
    case 'retry': return createRetryScenario(4);
    case 'multi-fail': return createMultiFailureScenario(5);
    case 'slow': return createSlowProcessingScenario(3);
    default: return createHappyPathScenario(4);
  }
}
