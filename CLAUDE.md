# ChigyuSubs - AI Agent Guidelines

> Browser-only subtitle translation tool for Japanese comedy content.

## Quick Links

- **Documentation**: @docs/DOCUMENTATION.md
- **Project Scope**: @docs/MISSION.md
- **Architecture**: @docs/developer/architecture.md
- **File Locations**: @docs/reference/file-structure.md
- **Cost/Tokenomics**: @docs/reference/tokenomics.md

## What This Project Is

A **browser-only** (no backend) subtitle translation tool optimized for Japanese comedy:
- VTT/SRT translation with AI-generated glossary + summary context
- Video transcription (Gemini-only, experimental)
- Multi-provider support (Gemini, OpenAI, Anthropic, Ollama)
- Chunked parallel processing with retries
- Media upload for context generation (summary only, not sent with translation chunks)

**Tech**: React + TypeScript + Vite, client-side only

## Project Structure

```
src/
  features/           # transcription/, translation/
  lib/
    providers/        # Multi-provider abstraction
    structured/       # JSON schema & validation (experimental)
  components/         # UI components
  hooks/              # State management
  config/             # Defaults

docs/                 # See DOCUMENTATION.md for index
scripts/              # Utility scripts
```

## Key Constraints (Architecture)

### Browser-Only
- ❌ No backend services
- ❌ No API key persistence (privacy-first)
- ✅ All processing client-side (chunking, validation, API calls)

### Translation Workflow
- Media uploads ONLY for summary generation
- Translation chunks are TEXT-ONLY (no media sent)
- Concurrency capped at 10 (Gemini free tier RPM limit)

### Provider Usage
- **Gemini**: Only provider with media upload + vision (default, extensively tested)
- **Others**: Implemented but not battle-tested for this use case
- See `@docs/reference/providers.md` for comparison

## Critical Code Patterns

### Use Provider Factory

```typescript
import { ProviderFactory } from "./lib/providers";

const provider = ProviderFactory.create("gemini", {
  apiKey: apiKey,
  modelName: "gemini-2.5-flash"
});

const result = await provider.generateContent({
  systemPrompt: "...",
  userPrompt: "...",
  temperature: 0.7
});
```

### Always Validate VTT

```typescript
import { validateVtt, autoRepairVtt } from "./lib/validator";

const result = validateVtt(vttText);
if (!result.valid) {
  const repaired = autoRepairVtt(vttText);
  // Check again or fail
}
```

### Chunks Are Stateless

```typescript
// Include full context in each chunk
const prompt = buildUserPrompt({
  glossary: glossaryText,      // Shared
  summaryText: summaryText,    // Shared
  previousCues: overlapCues,   // 1-2 from previous chunk
  currentCues: chunkCues       // Current chunk
});
```

## Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run test             # Run tests
npm run lint             # Lint code
```

## What NOT to Do

❌ **Don't** add backend services
❌ **Don't** persist API keys
❌ **Don't** send media with translation chunks
❌ **Don't** exceed concurrency of 10
❌ **Don't** alter VTT timestamps (breaks video sync)
❌ **Don't** use Gemini thinking mode for transcription
❌ **Don't** create chunks >2min (transcription) or >10min (translation)
❌ **Don't** add analytics or third-party tracking

## Project Philosophy

- **Solo hobby project**: One person maintaining
- **Focused scope**: Japanese comedy only (other content may work but not tested)
- **Quality target**: "Good enough to share" (not broadcast-perfect)
- **Privacy-first**: No backend, no key storage
- **Cost-conscious**: Optimize for Gemini free tier

**Not in scope**: Other languages, real-time streaming, professional quality, backend services

## Debug Mode

Enable with `?debug=1` or `localStorage.debugEvents="1"` for:
- Internal event logging
- Debug UI controls
- Never logs API keys or full prompts

## Recent Notes

- **Branch**: `structured-output` - experimental transcription with JSON schema
- **Tested extensively**: Gemini only
- **Other providers**: Implemented but unproven for this use case
- **Docs reorganized**: See @docs/DOCUMENTATION.md for navigation

## When in Doubt

1. Check existing patterns in the codebase
2. See @docs/DOCUMENTATION.md for full docs
3. Ask clarifying questions before assuming
4. Keep it simple - avoid over-engineering
5. Test with real Japanese comedy content

---

**Complete documentation**: @docs/DOCUMENTATION.md
**Contributing guidelines**: @CONTRIBUTING.md
