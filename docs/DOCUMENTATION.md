# ChigyuSubs Documentation

> **Project Mission**: Build a browser-only subtitle translation tool focused on Japanese comedy content. See [MISSION.md](./MISSION.md) for scope and goals.

## For Users

### Usage Guides
- **[Translation Guide](./user/translation-guide.md)** - How to translate subtitles with glossary and summary
- **[Transcription Guide](./user/transcription-guide.md)** - How to transcribe videos to subtitles *(coming soon)*

---

## For Developers

### Architecture & Design
- **[Architecture](./developer/architecture.md)** - System design decisions and rationale
- **[Prompt Engineering](./developer/prompt-engineering.md)** - How prompts are structured and why
- **[Provider Abstraction](./developer/provider-abstraction.md)** - Multi-provider system design
- **[Provider UI Architecture](./developer/provider-ui-architecture.md)** - Dynamic UI based on provider capabilities

### Experimental Features
- **[Structured Output](./developer/structured-output.md)** - JSON-based transcription workflow (experimental branch)

### Testing & Development
- **[Mock Mode](./developer/mock-mode.md)** - Testing UX flows without consuming API quota
- **[Testing Guide](./developer/testing.md)** - How to test, fixtures *(coming soon)*

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
- **[File Structure](./reference/file-structure.md)** - Quick reference for finding code
- **[Legal](./reference/legal.md)** - Copyright, licensing, and usage terms

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
1. **User docs** go in `user/` - focus on "how to use"
2. **Developer docs** go in `developer/` - focus on "how it works"
3. **Reference docs** go in `reference/` - technical specifications
4. **Archive** completed work - preserve history but keep main docs clean
5. Update DOCUMENTATION.md (this file) with links to new docs
