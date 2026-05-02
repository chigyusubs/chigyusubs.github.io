# ChigyuSubs site

Static site at chigyusubs.github.io. Lists subtitle files crawled from contributor repos in `registry.json`.

## Files

- `registry.json` — list of contributor repos (human-edited)
- `shows.json` — show metadata + YouTube video links keyed by VTT filename (human-edited)
- `index.json` — generated subtitle file index (**do not hand-edit, do not commit by hand**)
- `build.js` — crawls contributor repos via GitHub API, writes `index.json`
- `.github/workflows/build.yml` — runs `build.js` hourly, on push to main, and on `subtitles-updated` repository_dispatch from `chigyusubs/subtitles`

## How `index.json` updates

The Action rebuilds it. Don't run `node build.js` locally and commit the result — you'll race the cron and create rebase conflicts. Push your other changes (e.g. `shows.json`); the Action will refresh `index.json` within the hour, or immediately if you triggered a `repository_dispatch`.

## Adding a new YouTube-hosted episode

The VTT lives in the `chigyusubs/subtitles` repo; the YouTube link lives here. Both edits are required.

1. In `chigyusubs/subtitles`: add `youtube/<slug>.en.vtt` and a row in `README.md` under "## YouTube". Push.
2. In this repo: add `"<slug>.en.vtt": "https://www.youtube.com/watch?v=..."` under `youtube.links` in `shows.json`. Commit + push **only `shows.json`**.
3. The Action picks up the new VTT and regenerates `index.json` automatically.
