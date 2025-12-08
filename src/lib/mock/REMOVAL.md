# How to Remove Mock Mode

Mock mode is intentionally designed for easy removal. All mock code is isolated in `src/lib/mock/` with clearly marked integration points.

## Quick Removal (2 minutes)

### 1. Delete the mock directory
```bash
rm -rf src/lib/mock/
```

### 2. Remove integration points (3 files)

**File: `src/lib/providers/ProviderFactory.ts`**

Remove these marked blocks:

```typescript
// DELETE THIS BLOCK (lines 7-11)
// ============================================================================
// MOCK MODE INTEGRATION (can be removed by deleting this block + src/lib/mock/)
// ============================================================================
import { MockProvider, isMockMode } from "../mock/MockProvider";
// ============================================================================
```

```typescript
// DELETE THIS BLOCK (lines 34-41)
// ============================================================================
// MOCK MODE: Return MockProvider when enabled (DELETE THIS BLOCK TO REMOVE MOCK)
// ============================================================================
if (isMockMode()) {
    console.log(`[ProviderFactory] Mock mode enabled, using MockProvider`);
    return new MockProvider(config);
}
// ============================================================================
```

**File: `src/App.tsx`**

Remove these marked blocks:

```typescript
// DELETE THIS BLOCK (lines 33-37)
// ============================================================================
// MOCK MODE UI (can be removed with src/lib/mock/)
// ============================================================================
import { MockModeIndicator } from "./components/MockModeIndicator";
// ============================================================================
```

```tsx
// DELETE THIS LINE (lines 99-100)
{/* Mock mode indicator - DELETE THIS LINE to remove mock mode UI */}
<MockModeIndicator />
```

**File: `src/components/MockModeIndicator.tsx`**

Delete the entire file:
```bash
rm src/components/MockModeIndicator.tsx
```

### 3. Clean up integration example files (optional)

These were created as documentation/examples and aren't imported anywhere:

```bash
rm src/lib/mock/integration-example.ts
rm src/lib/mock/provider.ts  # Old version, superseded by MockProvider.ts
```

### 4. Done!

Run the build to verify:
```bash
npm run build
```

There should be no errors. Mock mode is completely removed.

## What Gets Removed

### Code Files
- `src/lib/mock/` - Entire directory (MockProvider, utilities, docs)
- `src/components/MockModeIndicator.tsx` - UI banner component
- 3 small code blocks in ProviderFactory.ts and App.tsx

### Functionality
- `VITE_MOCK=1` environment variable support
- `?mock=1` URL parameter support
- Mock provider that simulates API calls
- Demo mode UI indicator
- All predefined mock scenarios

### What Remains
- All real provider implementations (Gemini, OpenAI, etc.)
- Translation/transcription logic unchanged
- No dead code or unused imports
- Clean build with zero overhead

## Verification Checklist

After removal, verify:

- [ ] `npm run build` succeeds with no errors
- [ ] No TypeScript errors in IDE
- [ ] No import errors for deleted files
- [ ] App runs normally in dev mode
- [ ] `?mock=1` URL param has no effect
- [ ] `VITE_MOCK=1` env var has no effect
- [ ] Search codebase for "mock" returns no references (except tests)

```bash
# Quick verification
grep -r "MockProvider" src/  # Should return nothing
grep -r "isMockMode" src/    # Should return nothing
grep -r "MockModeIndicator" src/  # Should return nothing
```

## Why It's So Easy

Mock mode was designed with the "remove later" requirement in mind:

1. **Single directory**: All mock code in `src/lib/mock/`
2. **Clearly marked integration points**: Every integration has `// DELETE THIS` comments
3. **No scattered dependencies**: Mock code doesn't import from real code
4. **Transparent replacement**: MockProvider implements same interface as real providers
5. **Conditional imports**: Only imported when actually used
6. **No runtime overhead when disabled**: Zero-cost abstraction when not in mock mode

## Partial Removal Options

If you only want to remove parts:

### Keep provider, remove UI indicator
Delete `MockModeIndicator.tsx` and its import in `App.tsx`. Keep ProviderFactory integration.

### Keep code, disable by default
Remove the `?mock=1` URL parameter check in `isMockMode()` function, keep dev mode support.

### Archive instead of delete
Move `src/lib/mock/` to `archive/mock/` or `docs/examples/mock/` for reference.

## Rollback

If you need to restore mock mode after removal:

```bash
# Restore from git
git checkout src/lib/mock/
git checkout src/components/MockModeIndicator.tsx
git checkout src/lib/providers/ProviderFactory.ts
git checkout src/App.tsx
```

Or refer to this commit for the complete implementation.
