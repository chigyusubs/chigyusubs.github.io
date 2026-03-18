# ChigyuSubs

Community subtitles for Japanese variety shows.

**[chigyusubs.github.io](https://chigyusubs.github.io)**

## Features

- **Subtitle index** — browse and download community-contributed subtitle files
- **Show metadata** — TMDB backdrops, Japanese titles, and links for each show
- **Watch page** — play videos with synced subtitles in the browser
  - YouTube embed with subtitle overlay
  - Local video files via drag-and-drop
  - Direct video URLs
  - Native `<track>` rendering with fullscreen support
  - Subtitle offset controls
- **Community contributions** — anyone can register their subtitle repo

## How it works

1. Contributors add their GitHub repo to [`registry.json`](registry.json)
2. [`build.js`](build.js) crawls each registered repo for subtitle files (`.srt`, `.ass`, `.ssa`, `.vtt`, `.sub`, `.sbv`)
3. The build outputs `index.json`, which the site reads at runtime to render the file browser
4. Show metadata (titles, images, links) lives in [`shows.json`](shows.json)
5. The index rebuilds automatically on push and hourly via GitHub Actions

## Local development

```sh
# Optional: set GITHUB_TOKEN to avoid rate limits
node build.js
python3 -m http.server 8123
```

Then open http://localhost:8123.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add your subtitles.

## Related

- [chigyusubs/subtitles](https://github.com/chigyusubs/subtitles) — subtitle files
- [chigyusubs/chigyusubs-pipeline](https://github.com/chigyusubs/chigyusubs-pipeline) — transcription and translation pipeline
