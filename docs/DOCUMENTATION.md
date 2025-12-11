# ChigyuSubs Documentation

> **Type**: Index | **Status**: Stable | **Last Updated**: 2025-12-10 | **Owner**: Documentation  
> **Source of truth**: Keep this index aligned with the docs tree and changelog.

> **Project Mission**: Build a browser-only subtitle transcription tool (primary) with optional structured translation, focused on Japanese comedy content. See [MISSION.md](./MISSION.md) for scope and goals.

## For Users

### Usage Guides
- **[Transcription Guide](./user/transcription-guide.md)** - Primary workflow: Gemini File API, structured mode
- **[Translation Guide](./user/translation-guide.md)** - Translate VTT/SRT via compact JSON → structured output → VTT rebuild

---

## For Developers

### Architecture & Design
- **[Prompt Architecture](./developer/architecture.md)** - Prompt design decisions and rationale
- **[Prompt Engineering](./developer/prompt-engineering.md)** - How prompts are structured and why
- **[Provider Abstraction](./developer/provider-abstraction.md)** - Multi-provider system design
- **[Provider UI Architecture](./developer/provider-ui-architecture.md)** - Dynamic UI based on provider capabilities
- **[Doc Style & Placement](./developer/doc-style.md)** - Folder conventions, required front matter, and doc upkeep

### Experimental Features
- **[Structured Output](./developer/structured-output.md)** - JSON-based transcription workflow (experimental branch)

### Testing & Development
- **[Mock Mode](./developer/mock-mode.md)** - Testing UX flows without consuming API quota
- **[Testing Guide](./developer/testing.md)** - How to run tests and use mock tooling

---

## Reference

Technical specifications and details:

### Provider Information
- **[Provider Comparison](./reference/providers.md)** - Compare all providers and choose the best one
- **Provider Setup Guides**:
  - [Gemini](./reference/providers/gemini.md) - Google's multimodal AI (default, recommended for comedy)
  - [OpenAI](./reference/providers/openai.md) - GPT-4 and GPT-3.5 models
  - [Anthropic](./reference/providers/anthropic.md) - Claude 3.5 models
  - [Ollama](./reference/providers/ollama.md) - Local models (privacy-first)

### Technical Specs
- **[Tokenomics](./reference/tokenomics.md)** - Cost estimates and token usage
- **[Transcription Workflow](./reference/transcription-workflow.md)** - Technical details of chunking and processing
- **[Transcription Session Save/Load](./reference/transcription-session-save-load.md)** - Save/resume progress across sessions
- **[Structured Transcription Resume](./reference/structured-transcription-resume.md)** - Cursor-based resume mechanism
- **[File Structure](./reference/file-structure.md)** - Quick reference for finding code
- **[Legal](./reference/legal.md)** - Copyright, licensing, and usage terms

---

## Changelog

- See [docs/CHANGELOG.md](./CHANGELOG.md) for recent documentation updates.

---

## Archive

Historical documents (completed migrations, old plans):
- [Multi-Provider Migration](./archive/multi-provider-migration.md) - Provider abstraction layer migration notes
- [Gemini Transcription Plan](./archive/gemini-transcription-plan.md) - Original transcription feature plan
- [Refactor History (2024)](./archive/refactor-2024.md) - Translation/transcription separation refactor

---

## Quick Links

- 🏠 [Project README](../README.md) - Main project page
- 🎯 [MISSION.md](./MISSION.md) - Why this project exists
- 🚀 [Live App](https://chigyusubs.github.io) - Try it now
- 🐛 [GitHub Issues](https://github.com/chigyusubs/chigyusubs/issues) - Report bugs or request features

---

## Contributing to Docs

When adding or updating documentation:
1. Add the required front matter (see [Doc Style & Placement](./developer/doc-style.md)).
2. **User docs** go in `user/` - focus on "how to use".
3. **Developer docs** go in `developer/` - focus on "how it works".
4. **Reference docs** go in `reference/` - technical specifications.
5. **Archive** completed work - preserve history but keep main docs clean.
6. Update this index and the changelog when links or structure change.
