# Mock Mode Integration Summary

Mock mode has been integrated into ChigyuSubs to enable testing of UX flows without consuming API quota.

## What Was Added

### New Files Created (8 files)

**Core Implementation:**
1. `src/lib/mock/MockProvider.ts` - Provider implementation (254 lines)
2. `src/components/MockModeIndicator.tsx` - UI banner (76 lines)

**Documentation:**
3. `src/lib/mock/README.md` - Usage guide
4. `src/lib/mock/REMOVAL.md` - Removal instructions
5. `src/lib/mock/provider.ts` - Standalone utilities (example)
6. `src/lib/mock/integration-example.ts` - Integration patterns (example)

**This Summary:**
7. `MOCK_MODE_INTEGRATION.md` - This file

### Files Modified (2 files)

**`src/lib/providers/ProviderFactory.ts`**
- Added 6 lines to import and conditionally return MockProvider
- Changes clearly marked with `// DELETE THIS` comments

**`src/App.tsx`**
- Added 2 lines to import and render MockModeIndicator
- Changes clearly marked with `// DELETE THIS LINE` comments

**Total changes to existing code: 8 lines across 2 files**

## How to Use

### Development Mode

Test UX flows during development:

```bash
# Happy path (all chunks succeed)
VITE_MOCK=1 npm run dev

# Retry scenario (chunk 2 fails once)
VITE_MOCK=1 VITE_MOCK_SCENARIO=retry npm run dev

# Multiple failures
VITE_MOCK=1 VITE_MOCK_SCENARIO=multi-fail npm run dev

# Slow processing (3s per chunk)
VITE_MOCK=1 VITE_MOCK_SCENARIO=slow npm run dev
```

Then use the app normally - all API calls will be mocked.

### Production Demo Mode

Share a live demo without consuming quota:

```
https://your-app.com?mock=1
https://your-app.com?mock=1&mock_scenario=retry
```

Users will see a prominent yellow banner indicating demo mode.

## What It Does

### Simulates API Behavior

**Transcription:**
- Returns valid VTT with Japanese text placeholders
- Simulates processing delays (500-3000ms)
- Respects chunk indices for proper stitching

**Translation:**
- Returns valid VTT with English text placeholders
- Preserves timing from transcription
- Simulates translation delays

**Error Scenarios:**
- Rate limit errors (429, with retry-after)
- Network timeouts
- Invalid response errors
- Deterministic failures (chunk 2 always fails in retry scenario)

### Respects State Machine

- **Pause/Resume:** MockProvider checks abort signals
- **Retry:** Tracks attempt counts, fails first try only
- **Concurrency:** Works with concurrent chunk processing
- **Progress:** Reports token usage and timing

### UI Feedback

Yellow banner at top of page:
- "🎭 DEMO MODE - Using mock data (no real API calls)"
- Shows current scenario name
- "Exit Demo" button to disable

## What It Doesn't Do

**Not for testing:**
- Data quality or transcription accuracy
- Chunk stitching logic (uses real VTT stitcher)
- Prompt engineering effectiveness
- Schema validation (returns hardcoded valid JSON)

**Why:** These require real API responses. Mock mode is only for testing the state machine (start/pause/resume/retry/reset).

## Design Principles

### 1. Transparent Integration

MockProvider implements `TranslationProvider` interface, so app code doesn't know it's using mock. No changes needed to translation/transcription logic.

### 2. Single Interception Point

All API calls go through `ProviderFactory.create()`. One conditional check enables mock for all providers.

### 3. Isolated Code

All mock code in `src/lib/mock/` directory. No scattered dependencies. Easy to delete.

### 4. Clearly Marked

Every integration point has `// DELETE THIS` comments. Easy to find and remove.

### 5. Zero Runtime Cost

When mock mode is disabled, the only overhead is a single `if (isMockMode())` check. No imports, no code paths.

## How to Remove

See detailed instructions in `src/lib/mock/REMOVAL.md`.

**Quick version:**
1. Delete `src/lib/mock/` directory
2. Delete `src/components/MockModeIndicator.tsx`
3. Remove marked blocks in `ProviderFactory.ts` (2 blocks, 8 lines total)
4. Remove marked lines in `App.tsx` (2 lines)

Takes ~2 minutes. Zero code left behind.

## Testing Checklist

Use mock mode to test these UX flows:

- [ ] Start translation/transcription
- [ ] Pause during processing
- [ ] Resume after pause
- [ ] Cancel (reset) mid-run
- [ ] Retry single failed chunk
- [ ] Retry multiple failed chunks
- [ ] Concurrent chunk processing
- [ ] Progress indicators update correctly
- [ ] Token counts displayed
- [ ] Timing information shown
- [ ] Final result stitched correctly
- [ ] Download VTT/SRT works
- [ ] Error messages displayed
- [ ] Rate limit errors show retry suggestion

All of the above can be tested without consuming API quota.

## Scenarios Reference

| Scenario | Description | Use For |
|----------|-------------|---------|
| `happy` | 4 chunks, 500-1000ms each, all succeed | Normal flow, pause/resume |
| `retry` | 4 chunks, chunk 2 fails first attempt | Retry button, failed→ok transition |
| `multi-fail` | 5 chunks, chunks 1 & 3 fail | Multiple retries, error messages |
| `slow` | 3 chunks, 3s each | Long delays, cancel during processing |

## Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_MOCK` | `1` or unset | unset | Enable mock mode in dev |
| `VITE_MOCK_SCENARIO` | `happy`, `retry`, `multi-fail`, `slow` | `happy` | Choose scenario |

## URL Parameters

| Parameter | Values | Default | Purpose |
|-----------|--------|---------|---------|
| `mock` | `1` or unset | unset | Enable mock mode in production |
| `mock_scenario` | `happy`, `retry`, `multi-fail`, `slow` | `happy` | Choose scenario |

## Console Output

When mock mode is active, you'll see:

```
[ProviderFactory] Mock mode enabled, using MockProvider
[MockProvider] Initialized with scenario: Retry Test
[MockProvider] Chunk 0 starting (delay: 800ms)
[MockProvider] Chunk 0 succeeded
[MockProvider] Chunk 2 starting (delay: 800ms)
[MockProvider] Chunk 2 failing (attempt 1)
[MockProvider] Chunk 2 starting (delay: 800ms)
[MockProvider] Chunk 2 succeeding on retry (attempt 2)
```

This helps verify mock behavior during testing.

## Known Limitations

1. **Chunk indices only:** Mock doesn't parse actual video content. Uses chunk index to generate mock data.

2. **Deterministic scenarios:** Can't test random/unpredictable API behavior. Scenarios are fixed.

3. **No network simulation:** Doesn't simulate connection issues, DNS failures, etc. Just API-level errors.

4. **Simplified token counting:** Returns fixed token counts (100/50/150), not realistic estimates.

5. **No streaming:** MockProvider doesn't implement streaming responses (real providers may).

These limitations are intentional - mock mode is for UX testing only.

## Future Enhancements (If Needed)

Potential improvements if mock mode proves useful:

1. **Custom scenarios:** UI to create custom chunk configs
2. **Save/load scenarios:** Export/import JSON scenario files
3. **Random mode:** Optional random failures for chaos testing
4. **Network simulation:** Simulate connection issues, not just API errors
5. **Realistic fixtures:** Load actual API responses as fixtures
6. **CLI support:** `--mock` flag for test scripts

Currently not implemented to keep the code simple and easy to remove.

## Questions?

See documentation:
- Usage: `src/lib/mock/README.md`
- Removal: `src/lib/mock/REMOVAL.md`
- Code: `src/lib/mock/MockProvider.ts`

Or check git history for this integration commit.
