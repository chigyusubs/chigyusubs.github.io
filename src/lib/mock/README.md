# Mock Provider System

Mock providers for testing chunk processing UX flows without consuming API quota.

> **Status**: Integrated and ready to use
> **Removal**: See [REMOVAL.md](./REMOVAL.md) for easy removal instructions

## Purpose

**What it's for:**
- Testing start/pause/resume/reset state machine
- Testing retry logic for failed chunks
- Testing concurrency controls
- Testing progress indicators
- UI iteration without API costs

**What it's NOT for:**
- Testing data quality or transcription accuracy
- Testing chunk stitching logic
- Testing prompt engineering
- Validating API response schemas

## Quick Start

### Development Mode

```bash
# Enable mock mode with default scenario (happy path)
VITE_MOCK=1 npm run dev

# With specific scenario
VITE_MOCK=1 VITE_MOCK_SCENARIO=retry npm run dev
VITE_MOCK=1 VITE_MOCK_SCENARIO=multi-fail npm run dev
VITE_MOCK=1 VITE_MOCK_SCENARIO=slow npm run dev
```

Then use the app normally:
- Upload any video file (won't be processed)
- Click "Start Translation" or "Start Transcription"
- Test pause/resume/retry/reset flows
- No API calls made, no quota consumed

### Production Demo Mode

Add `?mock=1` to the URL:

```
https://your-app.com?mock=1
https://your-app.com?mock=1&mock_scenario=retry
```

Users see a prominent yellow banner: "🎭 DEMO MODE - Using mock data"

The banner includes:
- Clear indication of demo mode
- Current scenario name
- "Exit Demo" button to disable mock mode

## Available Scenarios

### `happy` (default)
All chunks succeed with varying latency (500-1500ms).

**Use for:**
- Testing normal flow
- Testing pause/resume during processing
- Testing UI responsiveness

### `retry`
Chunk 2 fails on first attempt, succeeds on retry.

**Use for:**
- Testing retry button
- Testing retry queue
- Testing failed → ok state transition

### `multi-fail`
Chunks 1 and 3 fail with different error types.

**Use for:**
- Testing multiple simultaneous failures
- Testing different error messages
- Testing bulk retry scenarios

### `slow`
All chunks take 3 seconds to process.

**Use for:**
- Testing pause/resume with long delays
- Testing cancel during processing
- Testing progress indicators

## How It Works

Mock mode is transparently integrated at the **ProviderFactory** level:

1. User enables mock mode (`VITE_MOCK=1` or `?mock=1`)
2. `ProviderFactory.create()` checks `isMockMode()`
3. If true, returns `MockProvider` instead of real provider
4. MockProvider implements same `TranslationProvider` interface
5. App code unchanged - doesn't know it's using mock
6. UI shows banner to indicate demo mode

### Integration Points

Only 3 files were modified:

**`src/lib/providers/ProviderFactory.ts`** (6 lines added)
- Import MockProvider and isMockMode
- Check mock mode before creating provider
- Return MockProvider when enabled

**`src/App.tsx`** (2 lines added)
- Import MockModeIndicator component
- Render banner at top of page

**`src/components/MockModeIndicator.tsx`** (new file, 76 lines)
- Yellow banner component
- Shows scenario name
- Exit demo button

All changes clearly marked with `// DELETE THIS` comments for easy removal.

## Architecture

### Core Functions

```typescript
// Mock a transcription API call
mockTranscribe({
  chunkId: 0,
  config: { chunkId: 0, delay: 800, shouldFail: false },
  signal: abortController.signal,
  onProgress: (p) => console.log(`${p * 100}%`),
});

// Mock a translation API call
mockTranslate({
  chunkId: 0,
  config: { chunkId: 0, delay: 1000 },
  signal: abortController.signal,
});
```

### Integration Pattern

```typescript
async function processChunk(options) {
  if (isMockMode()) {
    const scenario = getActiveMockScenario();
    const config = scenario.chunks[options.chunkIdx];
    return mockTranscribe({ chunkId: options.chunkIdx, config });
  }

  // Real API call
  return realGeminiTranscribe(options);
}
```

### Deterministic Failures

Mock failures are **deterministic**, not random:
- Chunk 2 **always** fails in `retry` scenario
- Chunks 1 & 3 **always** fail in `multi-fail` scenario
- No surprises during debugging

### Abort Signal Support

Mock providers respect abort signals:
```typescript
const controller = new AbortController();
const promise = mockTranscribe({ config, signal: controller.signal });

// User clicks pause
controller.abort();

// Promise rejects with 'Request cancelled'
```

## UI Components

### MockModeIndicator

Shows banner when in demo mode:

```tsx
import { MockModeIndicator } from '@/components/MockModeIndicator';

function App() {
  return (
    <>
      <MockModeIndicator />
      {/* rest of app */}
    </>
  );
}
```

### MockDevTools (dev only)

Shows scenario switcher in bottom-right corner (dev mode only):

```tsx
import { MockDevTools } from '@/components/MockModeIndicator';

function App() {
  return (
    <>
      <MockModeIndicator />
      <MockDevTools />
      {/* rest of app */}
    </>
  );
}
```

## CLI Scripts

Add `--mock` flag to test scripts:

```bash
# Real API call
npm run test:structured video.mp4

# Mock mode (uses saved scenario)
npm run test:structured video.mp4 --mock

# Mock with specific scenario
npm run test:structured video.mp4 --mock retry
```

Implementation:
```typescript
import { parseCliMockFlag } from '@/lib/mock/integration-example';

const mockConfigs = parseCliMockFlag();
if (mockConfigs) {
  // Use mock provider
} else {
  // Use real API
}
```

## Mock Data Format

Minimal valid fixtures - **content doesn't matter**, only shape:

```json
{
  "cues": [
    {
      "start_seconds": 0,
      "end_seconds": 5,
      "text": "これはモックデータです",
      "speaker": "テスト太郎",
      "notes": "Mock transcription for testing UI"
    }
  ],
  "metadata": {
    "language": "ja",
    "duration": 5
  }
}
```

The text/speaker/notes are placeholders. Tests focus on **state transitions**, not data quality.

## Creating Custom Scenarios

```typescript
import { MockRunConfig } from '@/lib/mock/provider';

const customScenario: MockRunConfig = {
  mode: 'transcription',
  chunks: [
    { chunkId: 0, delay: 500 },
    { chunkId: 1, delay: 800, shouldFail: true, errorType: 'rate_limit' },
    { chunkId: 2, delay: 600 },
    { chunkId: 3, delay: 1200, shouldFail: true, errorType: 'network' },
  ],
};
```

## Error Types

- `rate_limit`: 429 error, retry suggested
- `network`: Connection timeout
- `invalid_response`: Malformed JSON (500 error)

## Best Practices

### ✅ Do
- Use mock for UI/UX iteration
- Use mock for state machine testing
- Use deterministic scenarios for specific test cases
- Make mock mode visually obvious

### ❌ Don't
- Don't use mock to test transcription quality
- Don't use mock to test prompt effectiveness
- Don't rely on mock for schema validation
- Don't make mock data realistic (wastes time)

## FAQ

**Q: Why not random failures?**
A: Deterministic failures make debugging easier. If chunk 2 fails, it fails every time.

**Q: Why minimal fixtures?**
A: We're testing the state machine, not data quality. Less data = faster tests.

**Q: Can I test stitching logic with mocks?**
A: No. Stitching needs real/realistic timestamps and overlaps. Use saved API responses for that.

**Q: Should mock be default?**
A: No. Explicit opt-in via `VITE_MOCK=1` or `?mock=1`. Never surprise users with fake data.
