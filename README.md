# ChigyuSubs

Browser-only subtitle tool with **transcription-first** workflow. Uses the Gemini File API in structured mode to transcribe media, then lets you translate any VTT (from our transcription or Whisper/other tools) via a structured JSON pipeline and rebuild VTT. Everything runs client-side with your API key.

Live app: https://chigyusubs.github.io (built from `main` via GitHub Actions)

## Key Features

- 🎥 **Structured transcription (primary)** — Gemini File API only, 1-minute chunking tuned for accuracy; outputs structured JSON and VTT.
- 🌐 **Browser-only** — No backend required; all processing stays client-side.
- 📝 **VTT/SRT input** — Translate any VTT/SRT (ours or Whisper/others) by converting to compact JSON, invoking a structured-output LLM, and rebuilding VTT.
- 🎨 **Customizable prompts** — Edit system/user prompts and import/export preset configurations.
- ⚡ **Concurrent processing** — Configurable chunk size and parallel requests for faster runs.
- 🔒 **Privacy-first** — API keys and files stay in-memory in your browser, never persisted. Use your browser’s password manager if you want to save per-provider keys.

## Prerequisites

- **Node.js 18+** (for local development)
- **API Key** — Choose one or more providers:
  - [Gemini API](https://aistudio.google.com/apikey) (default, recommended; **required for transcription**)
  - [OpenAI API](https://platform.openai.com/api-keys)
  - [Anthropic API](https://console.anthropic.com/)
  - [Ollama](https://ollama.ai/) (local, no API key required)

## Generating VTT subtitles

If you don't have subtitles yet, use [Whisper](https://github.com/openai/whisper) to transcribe your media:

```bash
# Install Whisper (requires Python)
pip install -U openai-whisper

# Generate VTT subtitles
whisper --model large --task transcribe --output_format vtt input.mp4
```

This creates `input.vtt` in the current directory. For better accuracy, consider using the `large` or `large-v3` model.

## Quickstart

```bash
npm install
npm run dev -- --host --port 5173
```

Open http://localhost:5173, paste your Gemini API key, and translate. You can build with `npm run build` for a static bundle.

**CSP note**: Dev uses Vite HMR which injects inline styles; `.env.development` sets `VITE_CSP_STYLE_INLINE="'unsafe-inline'"` so `npm run dev` works. Production builds use `.env.production` (blank) so the CSP ships without `unsafe-inline`.

## 📚 Documentation

### For Users
- **[Mission & Scope](./docs/MISSION.md)** — Why this tool exists, what it's for, and what to expect
- **[Translation Guide](./docs/user/translation-guide.md)** — How to translate subtitles with glossary and summary
- **[Transcription Guide](./docs/user/transcription-guide.md)** — How to generate subtitles from media (experimental)
- **[Provider Setup](./docs/reference/providers.md)** — Multi-provider overview with links to Gemini/OpenAI/Anthropic/Ollama guides
- **[Legal](./docs/reference/legal.md)** — Terms and privacy information

### For Developers & Agents
- **[Agent Instructions](./AGENTS.md)** — Guidelines for AI agents working with this codebase
- **[Documentation Index](./docs/DOCUMENTATION.md)** — Single entry point for user, developer, and reference docs
- **[Prompt Architecture](./docs/developer/architecture.md)** — Prompt design decisions and rationale
- **[Prompt Engineering](./docs/developer/prompt-engineering.md)** — Technical details of the translation prompt system
- **[Provider Abstraction](./docs/developer/provider-abstraction.md)** — Multi-provider system design
- **[Doc Style & Placement](./docs/developer/doc-style.md)** — Folder conventions, required front matter, and doc upkeep

### Quick Overview

- **Inputs**: Upload VTT or SRT subtitles; optionally upload media for AI-generated context summaries
- **Prompts**: Customize system and user prompts; import/export preset configurations
- **Context**: Generate glossaries from subtitles and summaries from media (both optional and editable)
- **Translation**: Configurable chunk size, concurrency, and temperature for optimal results

## Deploy

This repo uses GitHub Pages with GitHub Actions. See `.github/workflows/deploy.yml` for the build and deploy steps (it builds from `main` with `npm run build` and publishes the `dist/` bundle).

## How it uses Gemini

- **Transcription (primary path)**: Uses Gemini File API in structured mode; media is uploaded only for transcription and stays tied to that request. Transcription is Gemini-only in the UI.
- **Translation**: Accepts VTT/SRT, converts to compact JSON, and calls a structured-output model (Gemini 2.5/3 or GPT-4+); media is not sent with translation chunks.
- **Prompts**: System/summary/glossary/chunk prompts are customizable; structured translation uses a minimal JSON schema to avoid token waste.
- **API costs**: Usage may incur costs per your Google billing/quotas. You control the key and model selection.

## Project structure

- `src/` — React/Vite client (feature code under `src/`, shared utilities under `src/lib/`, assets bundled via Vite)
- `docs/` — Documentation (usage guide, API setup, design docs, prompt engineering reference)
- `.gitignore`, `LICENSE`, `AGENTS.md` — Repository metadata and agent guidelines

## Support & maintenance

This project is provided as-is with no guarantees or SLAs.

- **Bug reports**: Welcome! Please include clear reproduction steps.
- **Feature requests**: Unlikely to be accepted; forks are encouraged for experiments.
- **Response time**: I may not reply quickly (or at all).
- **Scope**: This tool will stay minimal and focused. Prompts are tested with Japanese comedy content—other source/target languages may work but aren't actively maintained.

## Scripts

- `npm run dev` — start the dev server.
- `npm run build` — production build.
- `npm run preview` — preview the production build locally.

## Security & privacy

- **Browser-only**: No backend; your Gemini API key stays in page state and is sent only to Gemini endpoints (never persisted).
- **API keys and files never stored**: API keys and uploaded files are kept in memory only and cleared on page refresh.
- **Media scope**: Uploads are used only to generate summaries; translation prompts remain text-only.
- **Content Security Policy**: Static builds include a CSP meta tag restricting scripts/styles to self, connect-src to Gemini API, blocking object/embed/frames.
- **Concurrency limits**: Capped at 10 to align with free-tier limits and reduce API abuse risk.

## Storage & preferences

- **What's saved**: Theme, model choice, prompts (system/summary/glossary), target language, chunk/concurrency/temperature settings, and toggles (including “Use glossary in summary generation”) are saved in `localStorage` for convenience.
- **What's NOT saved**: API keys and uploaded files are never persisted.
- **Clear storage**: Use browser storage clear if you want a fresh start.

## Debugging

- **API call logs**: Gemini API calls appear in the Debug log table.
- **Internal events**: A dev-only event buffer logs run/chunk/retry lifecycle. Enable via `?debug=1` or `localStorage.debugEvents="1"`.
- **Export events**: When enabled, a "Copy internal events" button exports a chronological JSON dump. Internal events never include keys or prompts.

## Contributing

Small, focused PRs are welcome. Please:

- Keep changes minimal and scoped to a single improvement
- Test locally with `npm run dev` and `npm run build` before submitting
- Explain the problem you're solving in the PR description

## License

MIT. See `LICENSE` for details.
