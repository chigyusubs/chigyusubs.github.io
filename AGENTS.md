# Repository Guidelines

## Project Structure & Module Organization
- Keep primary source under `src/`; group by domain, not by technical layer alone. Shared utilities live in `src/lib` and feature-specific code under `src/<feature>/`.
- Tests are colocated with source (e.g., `src/lib/__tests__`, `src/hooks/__tests__`); keep that pattern consistent.
- Store operational scripts in `scripts/` (setup, lint, formatting) and documentation assets in `docs/`.
- Use `config/` for environment or service configuration files; avoid scattering configs at the root.

## Build, Test, and Development Commands
- For this JS-only project, use package scripts directly (`npm run dev`, `npm run build`, `npm run test`, `npm run lint`). A Makefile is not required unless adding other tooling/languages; if you add one, keep targets simple pass-throughs.

## Coding Style & Naming Conventions
- Follow language defaults with minimal overrides; keep indentation at 2 spaces for YAML/JSON and 4 for most languages unless the ecosystem dictates otherwise.
- Prefer descriptive names: modules and files use `kebab-case` for scripts/configs and `snake_case` for Python; types/interfaces/classes use `PascalCase`; functions/variables use `camelCase`.
- Add or run a formatter (e.g., `prettier`, `black`, `gofmt`) via `make fmt` to keep diffs clean. Keep imports ordered by standard/library/local.

## Testing Guidelines
- Mirror source structure in `tests/`; name files `<unit>_test.<ext>` or `<unit>.spec.<ext>` consistent with the language.
- Include table-driven cases where possible and cover error paths. Add fixtures under `tests/fixtures/` when shared across suites.
- Gate new code with tests; prefer fast, deterministic unit tests. Document any integration tests and required services in `docs/testing.md` when added.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`) for clarity and changelog generation.
- Keep commits small and focused; include context in the body when behavior changes or migrations are involved.
- PRs should summarize changes, link relevant issues, and call out breaking changes or required follow-up. Add screenshots or sample outputs when UI or CLI behavior changes.

## Security & Configuration Tips
- Do not commit secrets; use environment files in `config/` with an `.example` template and load via your stack's dotenv mechanism.
- Pin tool versions in `Makefile` or `scripts/` to reduce drift. Document required services (DBs, queues) and their startup commands in `docs/setup.md` when introduced.

## Product & Design Goals
- Browser-only client: no backend services. All processing (chunking, validation, ffmpeg WASM, Gemini calls) should stay client-side.
- Gemini API key usage: assume free-tier keys. Do not encourage or require billing-linked keys; avoid features that store or transmit the key anywhere except directly to Gemini.
- Media upload scope: uploads are only for generating summaries; chunked translations must remain text-only. Keep this invariant in UX and code.
- Concurrency guardrails: cap translation concurrency at 10 to respect Gemini 2.5 Flash free-tier RPM; UI should enforce the same cap.
- Minimize attack surface: avoid new dependencies that phone home, collect analytics, or expand permissions. Prefer small, auditable libraries and document any security-sensitive additions.
- Debugging: keep Gemini API call logging separate from internal run/chunk/retry logging. Internal events are dev-only, avoid keys/prompts, and should remain modular so they can be disabled/removed easily. Enable via `?debug=1` or `localStorage.debugEvents="1"`; keep UI affordances (e.g., copy button) hidden when debug is off.

### Gemini API constraints (quick reference)
- Model priority: favor Gemini 2.5 Pro for production-quality runs (handles ~10-minute chunks, stronger summaries/glossaries, lower hallucination). Use Flash/Flash Preview mainly for quick testing or when Pro isn't available.
- Rate limits (free tier): 2 RPM for Gemini 2.5 Pro (125k TPM, 50 RPD); 10 RPM for Gemini 2.5 Flash/Flash Preview (250k TPM, 250 RPD). Treat concurrency caps and UI hints accordingly.
- Quotas apply per project, not per API key; limits can vary by model/tier and may change.
- Batch API/file upload limits: 2GB per input file, 20GB total stored files; avoid designs that exceed those in-browser.
- Token/latency guidance: keep media resolution low/standard when uploading video for summaries to stay within free-tier TPM and reduce latency. Avoid token-heavy options unless there’s a clear quality need; stick to text-only translation prompts.
- Video usage (summary-only): prefer one video per request via the File API; keep files small/short to avoid high token burn (~300 tokens/sec at default resolution, ~100/sec at low). Do not rely on YouTube URLs; inline video is only practical under ~20MB.
- Safety filters: default safety is on; disabling safety may trigger Google review. Use `safetyOff` sparingly and only when justified; do not ship features that rely on unsafe outputs. Stick to translation/summarization; avoid generating disallowed content.
- Hosting security: static build includes a CSP meta tag restricting scripts/styles to self and connect-src to the Gemini API; update if you add other trusted endpoints. Avoid adding analytics/third-party scripts without reviewing CSP.
- API efficiency: avoid unnecessary Gemini calls to preserve free-tier RPM/TPM and cost. Ensure resets/new runs cancel in-flight/queued calls; never retry or send requests from stale runs.
