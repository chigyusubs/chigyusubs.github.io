/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Mock provider for testing UX flows without consuming API quota
 *
 * Implements TranslationProvider interface to seamlessly replace real providers
 * in demo/test mode. All mock code is isolated in src/lib/mock/ for easy removal.
 */

import type {
  TranslationProvider,
  ProviderType,
  ProviderCapabilities,
  ProviderConfig,
  GenerateRequest,
  GenerateResponse,
  ModelInfo,
} from "../providers/types";
import { addProviderLog, updateProviderLog } from "../providerLog";

// ============================================================================
// Mock Configuration
// ============================================================================

interface MockScenarioChunk {
  chunkId: number;
  delay: number;
  shouldFail?: boolean;
  errorType?: 'rate_limit' | 'network' | 'invalid_response';
}

interface MockScenario {
  name: string;
  chunks: MockScenarioChunk[];
}

// Predefined scenarios
const SCENARIOS: Record<string, MockScenario> = {
  happy: {
    name: 'Happy Path',
    chunks: Array.from({ length: 4 }, (_, i) => ({
      chunkId: i,
      delay: 500 + Math.random() * 500, // 500-1000ms
    })),
  },
  retry: {
    name: 'Retry Test',
    chunks: Array.from({ length: 4 }, (_, i) => ({
      chunkId: i,
      delay: 800,
      // Chunk 2 fails first attempt
      shouldFail: i === 2,
      errorType: 'rate_limit' as const,
    })),
  },
  'multi-fail': {
    name: 'Multiple Failures',
    chunks: Array.from({ length: 5 }, (_, i) => ({
      chunkId: i,
      delay: 700,
      shouldFail: i === 1 || i === 3,
      errorType: (i === 1 ? 'rate_limit' : 'network') as const,
    })),
  },
  slow: {
    name: 'Slow Processing',
    chunks: Array.from({ length: 3 }, (_, i) => ({
      chunkId: i,
      delay: 3000, // 3 seconds
    })),
  },
};

// ============================================================================
// MockProvider Class
// ============================================================================

export class MockProvider implements TranslationProvider {
  readonly type: ProviderType = 'gemini'; // Masquerade as Gemini
  readonly capabilities: ProviderCapabilities = {
    supportsMediaUpload: true,
    supportsVision: true,
    supportsTemperature: true,
    supportsSafetySettings: true,
    requiresApiKey: false, // Mock doesn't need API key
    supportsStreaming: false,
    canTranscribeAudio: true,
  };

  private config: ProviderConfig;
  private scenario: MockScenario;
  private chunkAttempts: Map<number, number> = new Map(); // Track retry attempts

  constructor(config: ProviderConfig) {
    this.config = config;

    // Determine scenario from environment or default to happy path
    const scenarioName = this.getScenarioName();
    this.scenario = SCENARIOS[scenarioName] || SCENARIOS.happy;

    console.log(`[MockProvider] Initialized with scenario: ${this.scenario.name}`);
  }

  private getScenarioName(): string {
    // Dev mode: VITE_MOCK_SCENARIO
    if (import.meta.env.VITE_MOCK_SCENARIO) {
      return import.meta.env.VITE_MOCK_SCENARIO;
    }

    // Prod mode: URL param
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mock_scenario') || 'happy';
    }

    return 'happy';
  }

  private getChunkConfig(chunkIdx: number): MockScenarioChunk {
    // Find chunk config or use default
    const config = this.scenario.chunks.find(c => c.chunkId === chunkIdx);
    if (config) return config;

    // Default config for chunks not in scenario
    return {
      chunkId: chunkIdx,
      delay: 800,
    };
  }

  /**
   * Main method: generate content (translation or transcription)
   */
  async generateContent(
    request: GenerateRequest,
    trace?: { purpose: string; chunkIdx?: number; runId?: number }
  ): Promise<GenerateResponse> {
    const chunkIdx = trace?.chunkIdx ?? 0;
    const config = this.getChunkConfig(chunkIdx);
    const startedAt = Date.now();

    // Log request immediately with pending status
    const logId = addProviderLog({
      provider: 'gemini', // Mock masquerades as Gemini
      purpose: trace?.purpose || 'generateContent',
      status: 'pending',
      model: this.config.modelName,
      temperature: request.temperature,
      safetyOff: request.safetyOff,
      chunkIdx: trace?.chunkIdx,
      runId: trace?.runId,
      message: '[Mock] Simulating API call...',
    });

    console.log(`[MockProvider] Chunk ${chunkIdx} starting (delay: 5000ms)`);

    try {
      // Simulate processing delay (fixed 5 seconds)
      await this.sleep(5000);

      // Check if this chunk should fail
      if (config.shouldFail) {
        const attemptCount = this.chunkAttempts.get(chunkIdx) || 0;
        this.chunkAttempts.set(chunkIdx, attemptCount + 1);

        // Fail only on first attempt (allow retries to succeed)
        if (attemptCount === 0) {
          console.log(`[MockProvider] Chunk ${chunkIdx} failing (attempt ${attemptCount + 1})`);
          const error = this.createMockError(config.errorType || 'rate_limit', chunkIdx);

          // Update log with error status
          updateProviderLog(logId, {
            status: 'error',
            durationMs: Date.now() - startedAt,
            message: error.message,
          });

          throw error;
        } else {
          console.log(`[MockProvider] Chunk ${chunkIdx} succeeding on retry (attempt ${attemptCount + 1})`);
        }
      }

      // Parse expected cue count from prompt
      const expectedCues = this.extractExpectedCueCount(request.userPrompt);

      // Generate mock response based on request type
      const isTranscription = request.userPrompt.toLowerCase().includes('transcribe');
      const text = isTranscription
        ? this.generateMockVtt(chunkIdx, expectedCues)
        : this.generateMockTranslatedVtt(chunkIdx, expectedCues);

      console.log(`[MockProvider] Chunk ${chunkIdx} succeeded (${expectedCues} cues)`);

      const usage = {
        promptTokens: expectedCues * 20,  // Rough estimate
        responseTokens: expectedCues * 15,
        totalTokens: expectedCues * 35,
      };

      // Update log with success status
      updateProviderLog(logId, {
        status: 'ok',
        durationMs: Date.now() - startedAt,
        tokens: usage,
        message: undefined, // Clear mock message
      });

      return {
        text,
        usage,
      };
    } catch (err) {
      // If we haven't updated the log yet (e.g., unexpected error)
      if (err instanceof Error && !err.message.includes('[Mock]')) {
        updateProviderLog(logId, {
          status: 'error',
          durationMs: Date.now() - startedAt,
          message: err.message,
        });
      }
      throw err;
    }
  }

  /**
   * Extract expected cue count from prompt
   * Looks for patterns like "Output exactly 41 cues" or "Translate ALL cues above"
   */
  private extractExpectedCueCount(prompt: string): number {
    // Try to find "Output exactly N cues"
    const exactMatch = prompt.match(/Output exactly (\d+) cues/i);
    if (exactMatch) {
      return parseInt(exactMatch[1], 10);
    }

    // Try to find "expected N, got" from validation messages
    const expectedMatch = prompt.match(/expected (\d+)/i);
    if (expectedMatch) {
      return parseInt(expectedMatch[1], 10);
    }

    // Count cue blocks in the prompt (look for timecode patterns)
    const timecodeMatches = prompt.match(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/g);
    if (timecodeMatches && timecodeMatches.length > 0) {
      return timecodeMatches.length;
    }

    // Default to small number if can't determine
    return 4;
  }

  /**
   * Generate mock VTT for transcription
   */
  private generateMockVtt(chunkIdx: number, cueCount: number): string {
    // Generate proper timecodes with HH:MM:SS.mmm format
    const baseSeconds = chunkIdx * 60; // Offset by 60 seconds per chunk
    const cues: string[] = [];

    // Generate the requested number of cues
    for (let i = 0; i < cueCount; i++) {
      const startSeconds = baseSeconds + (i * 3);  // 3 seconds per cue
      const endSeconds = startSeconds + 2.5;       // 2.5 second duration

      const cueNumber = chunkIdx * 100 + i + 1;
      const startTime = this.formatTimecode(startSeconds);
      const endTime = this.formatTimecode(endSeconds);

      cues.push(`${cueNumber}
${startTime} --> ${endTime}
これはモックデータ ${i + 1} です`);
    }

    return `WEBVTT\n\n${cues.join('\n\n')}`;
  }

  /**
   * Generate mock VTT for translation
   */
  private generateMockTranslatedVtt(chunkIdx: number, cueCount: number): string {
    const baseSeconds = chunkIdx * 60;
    const cues: string[] = [];

    // Generate the requested number of cues
    for (let i = 0; i < cueCount; i++) {
      const startSeconds = baseSeconds + (i * 3);  // 3 seconds per cue
      const endSeconds = startSeconds + 2.5;       // 2.5 second duration

      const cueNumber = chunkIdx * 100 + i + 1;
      const startTime = this.formatTimecode(startSeconds);
      const endTime = this.formatTimecode(endSeconds);

      cues.push(`${cueNumber}
${startTime} --> ${endTime}
This is mock data ${i + 1}`);
    }

    return `WEBVTT\n\n${cues.join('\n\n')}`;
  }

  /**
   * Format seconds to VTT timecode (HH:MM:SS.mmm)
   */
  private formatTimecode(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }

  /**
   * Create mock error for testing error handling
   */
  private createMockError(type: string, chunkIdx: number): Error {
    const error: any = new Error(`[Mock] ${type} error for chunk ${chunkIdx}`);

    switch (type) {
      case 'rate_limit':
        error.statusCode = 429;
        error.code = 'RESOURCE_EXHAUSTED';
        error.isRateLimited = true;
        error.retryAfter = 1; // 1 second
        break;

      case 'network':
        error.statusCode = 0;
        error.code = 'NETWORK_ERROR';
        break;

      case 'invalid_response':
        error.statusCode = 500;
        error.code = 'INVALID_SCHEMA';
        break;
    }

    return error;
  }

  /**
   * Simulate async delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * List available models (mock)
   */
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-model',
        displayName: 'Mock Model (Demo Mode)',
        provider: 'gemini',
        description: 'Simulated model for testing UX flows',
      },
    ];
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      name: 'Mock Provider',
      description: 'Simulated provider for testing (no real API calls)',
      capabilities: this.capabilities,
    };
  }

  /**
   * Validate config (always valid for mock)
   */
  validateConfig(_config: ProviderConfig): boolean {
    return true;
  }

  /**
   * Mock media upload (no-op)
   */
  async uploadMedia(file: File): Promise<{ fileUri: string; fileName?: string }> {
    console.log(`[MockProvider] Mock upload: ${file.name}`);
    return {
      fileUri: `mock://uploaded/${file.name}`,
      fileName: file.name,
    };
  }

  /**
   * Mock media deletion (no-op)
   */
  async deleteMedia(fileNameOrUri: string): Promise<void> {
    console.log(`[MockProvider] Mock delete: ${fileNameOrUri}`);
  }

  /**
   * Mock audio transcription
   */
  async transcribeAudio(
    file: File,
    _language?: string,
    _audioDuration?: number,
    _model?: string
  ): Promise<string> {
    console.log(`[MockProvider] Mock transcribe audio: ${file.name}`);

    // Simulate processing delay
    await this.sleep(5000);

    // Return mock VTT with reasonable number of cues
    return this.generateMockVtt(0, 10);
  }
}

// ============================================================================
// Utilities
// ============================================================================

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
