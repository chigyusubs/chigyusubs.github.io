# ChigyuSubs

Browser-only subtitle translator for VTT or SRT files powered by Gemini. Upload subtitles, optionally provide media context, and translate to your target language directly from the page. Chunking, validation, and Gemini calls all run in the client with your API key.

Live app: https://chigyusubs.github.io (built from `main` via GitHub Actions)

## Key Features

- 🌐 **Browser-only translation** — No backend required; everything runs client-side
- 📝 **VTT/SRT support** — Works with standard subtitle formats
- 🎬 **Optional media context** — Upload media for AI-generated summaries to improve translation accuracy
- 📚 **Smart glossary generation** — Automatically extract terms from subtitles or create custom glossaries
- 🎨 **Customizable prompts** — Edit system/user prompts and import/export preset configurations
- ⚡ **Concurrent processing** — Configurable chunk size and parallel requests for faster translation
- 🔒 **Privacy-first** — Your API key and files stay in your browser, never persisted or sent elsewhere

## Prerequisites

- **Node.js 18+** (for local development)
- **Gemini API key** — [Get one from Google AI Studio](https://aistudio.google.com/apikey)

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

## Usage

For detailed documentation on features, controls, and workflows, see [USAGE.md](USAGE.md).

### Quick overview

- **Inputs**: Upload VTT or SRT subtitles; optionally upload media for AI-generated context summaries
- **Prompts**: Customize system and user prompts; import/export preset configurations
- **Context**: Generate glossaries from subtitles and summaries from media (both optional and editable)
- **Translation**: Configurable chunk size, concurrency, and temperature for optimal results

## Deploy
This repo uses GitHub Pages with GitHub Actions. See `.github/workflows/deploy.yml` for the build and deploy steps (it builds from `main` with `npm run build` and publishes the `dist/` bundle).

## How it uses Gemini

- **Subtitles**: Sent to Gemini only when you click "Translate" (chunked according to your settings).
- **Media**: Sent only when you explicitly click "Upload media," and used solely for summary generation (never embedded in translation prompts).
- **Prompts**: System and user prompts are fully customizable. You can import/export custom prompt presets as JSON to share configurations.
- **API costs**: Usage may incur costs per your Google billing/quotas. You control the key and model selection.

## Project structure

- `src/` — React/Vite client (feature code under `src/`, shared utilities under `src/lib/`, assets bundled via Vite)
- `USAGE.md` — Detailed usage guide with button documentation and media prep tips
- `.gitignore`, `LEGAL.md`, `LICENSE` — Repository metadata

## Support & maintenance

This project is provided as-is with no guarantees or SLAs.

- **Bug reports**: Welcome! Please include clear reproduction steps.
- **Feature requests**: Unlikely to be accepted; forks are encouraged for experiments.
- **Response time**: I may not reply quickly (or at all).
- **Scope**: This tool will stay minimal and focused.

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
- **What's saved**: Theme, model choice, prompts (system/summary/glossary), language/style/chunk/concurrency/temperature settings, and toggles are saved in `localStorage` for convenience.
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
