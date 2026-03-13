# ChiguyuSubs

Community subtitles for Japanese variety shows.

ChiguyuSubs is a static site hosted on GitHub Pages that aggregates subtitle files from contributor repositories. Contributors register their repos in `registry.json`, and a build script crawls them via the GitHub API to produce a unified index.

## How it works

1. Contributors add their GitHub repo to [`registry.json`](registry.json)
2. [`build.js`](build.js) crawls each registered repo for subtitle files (`.srt`, `.ass`, `.ssa`, `.vtt`, `.sub`, `.sbv`)
3. The build outputs `index.json`, which the site reads at runtime to render the file browser
4. The site rebuilds automatically every hour via GitHub Actions

## Local development

Rebuild the index locally:

```sh
# Optional: set GITHUB_TOKEN to avoid rate limits
node build.js
```

Then open `index.html` in a browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add your subtitles.
