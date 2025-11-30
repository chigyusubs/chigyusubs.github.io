# ChigyuSubs

Browser-only subtitle translator for VTT or SRT files powered by Gemini. Upload subtitles, optionally provide media context, and translate to your target language directly from the page. Chunking, validation, and Gemini calls all run in the client with your API key.

## Quickstart (Node 18+)
```bash
npm install
npm run dev -- --host --port 5173
```
Open http://localhost:5173, paste your Gemini API key, and translate. You can build with `npm run build` for a static bundle.

## Deploy to GitHub Pages
- The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds on pushes to `main` and deploys the `dist/` bundle to Pages.
- Set the Pages source to “GitHub Actions” in the repo settings.
- The Vite base is `/` so it serves correctly at `https://chigyusubs.github.io`. If you later use a subpath or custom domain, adjust `base` in `vite.config.ts`.
- To trigger manually, run the “Deploy to GitHub Pages” workflow from the Actions tab.

## Data flow & costs
- Subtitles are sent to Gemini only when you click “Translate.” Media is sent only when you explicitly click “Upload media,” and the uploaded media is used for summary generation only (never embedded in translation prompts).
- API usage may incur costs per your Google billing/quotas. You control the key and model selection.

## Optional media prep tips
- For text-only runs, you can skip media upload entirely.
- If you upload media for context and want to keep it small, a lightweight video is fine; if you choose audio-only, the video codec doesn’t matter. A practical downscale command:
  ```bash
  ffmpeg -i input.mp4 \
    -vf "scale='min(640,iw)':-2,fps=1" \
    -c:v libx264 -profile:v baseline -preset veryfast -crf 30 \
    -c:a aac -ac 1 -ar 16000 -b:a 48k \
    -movflags +faststart \
    output_llm.mp4
  ```
  For audio-only context: `ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a aac -b:a 48k output.m4a`

## Project structure
- `src/` — React/Vite client (feature code under `src/`, shared utilities under `src/lib/`, assets bundled via Vite).
- `.gitignore`, `LEGAL.md`, `LICENSE` — repository metadata.

## UI basics
- Inputs: VTT or SRT subtitles; optional media for context summary only (not sent with chunk prompts).
- Context: you can generate a media summary (optional) and a glossary from subtitles; both are editable and can be toggled on/off.
- Prompts: the system prompt holds the guardrails (editable). User prompt is structured data (langs, style, optional summary/glossary, context, cues). Glossary lives in the user prompt only.
  - Controls: concurrency, chunk length, style (freeform), temperature, summary/glossary toggles. Defaults are tuned for Gemini 2.5 Pro (10m chunks, concurrency 2). Concurrency is capped at 10 even if you enter a higher number (to respect Gemini 2.5 Flash free-tier RPM). Overlap pulls prior cues (default 2) as context; raise if you see continuity issues.

## Guidance for glossary & summary
- Generate both to save time, but plan to skim and edit before large runs for best consistency.
- Keep glossary entries canonical (names/terms in one form). If the summary paraphrases names, tighten it up or keep names in the source language to avoid nudging variants.
- The model prioritizes the glossary for term consistency; the summary is secondary context. Differences between them typically don’t break translation, but cleaning them up reduces variance.

## Buttons & behaviors
- Translate: validates subtitles + API key, parses/chunks, and sends only the subtitle text to Gemini for translation. It does not upload or extract media; media is ignored unless you have already uploaded it for summary generation.
- Upload media to Gemini: uploads the selected media file solely for summary generation. If “Upload audio-only” is checked and you chose a video, it first extracts audio to a small mono OGG and uploads that smaller file.
- Delete uploaded media: removes the previously uploaded media from Gemini and clears local refs.
- Refresh models: lists available Gemini models using your API key and updates the dropdown.
- Generate summary from media: runs a summary request against the uploaded media; fills the summary text field.
- Generate from subtitles (glossary): builds a glossary from your subtitles (local heuristic if no API key; Gemini call if key is present).
- Toggles: “Upload audio-only” controls extraction during upload; “Use summary in translation” and “Use glossary in translation” decide whether those optional contexts are included in the prompt payload.

## Support expectations
- Shared as-is with no guarantees or SLAs. I may not reply quickly (or at all).
- Issues are welcome for clear bugs; please include steps to reproduce. Feature requests are unlikely to be accepted.
- PRs are welcome but should stay small and focused; they may be closed without merge if they widen scope or add maintenance burden.
- Forks are encouraged for experiments or larger changes; upstream will stay minimal.

## Scripts
- `npm run dev` — start the dev server.
- `npm run build` — production build.
- `npm run preview` — preview the production build locally.

## Security notes
- Browser-only: no backend; the Gemini API key stays in page state and is sent only to Gemini endpoints (not persisted).
- Media scope: uploads are used only to generate summaries; translation prompts remain text-only.
- Concurrency is capped at 10 to align with free-tier limits and reduce API abuse risk.
- Content Security Policy: static builds include a CSP meta tag restricting scripts/styles to self, connect-src to Gemini API, blocking object/embed/frames. Adjust only if you add other trusted endpoints or assets.
- Controls: Pause stops starting new chunks/retries (in-flight calls continue); Reset clears progress and drops queued work while keeping uploaded media. Designed to avoid wasting RPM/TPM/cost on stale runs.
- Preferences: theme, model choice, and other non-sensitive settings are stored locally in your browser. API keys and files are never persisted.
- Local storage: model list/choice, prompts (system/summary/glossary), summary/glossary text, language/style/chunk/concurrency/temperature, safety toggle, media resolution, and audio-only are saved in `localStorage` for convenience. Use browser storage clear if you want a fresh start; secrets are not saved.
- Run behavior: runs are tagged with a run ID; paused chunks show a paused status and resume to processing with a fresh timestamp; stale updates are ignored after Reset/new runs to avoid extra Gemini calls.
- Restore defaults: per-field restore buttons reset prompts; the footer “Restore defaults” resets saved preferences but keeps summary/glossary text. It does not affect files or API key.
- Debugging: Gemini API calls appear in the Debug log table. A separate internal event buffer (dev-only) logs run/chunk/retry lifecycle; enable via `?debug=1` or `localStorage.debugEvents="1"`. When enabled, a “Copy internal events” button exports a chronological JSON dump. Internal events never include keys or prompts.

## License
MIT. See `LICENSE` for details.
