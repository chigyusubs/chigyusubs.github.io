# Contributing

Want your subtitles listed on ChiguyuSubs? Here's how.

## 1. Create a public GitHub repo

Put your subtitle files in a public GitHub repository. Organize them however you like:

```
# Flat by airdate
wednesday-downtown/
  2026-01-07.srt

# By season
documental/
  S11/
    E01.srt

# Multiple shows
wednesday-downtown/
  2026-01-07.srt
lincoln/
  S2008/
    E01.srt
```

## 2. Supported formats

`.srt`, `.ass`, `.ssa`, `.vtt`, `.sub`, `.sbv`

Everything else in your repo (README, LICENSE, images, scripts) is ignored.

## 3. Register

Submit a PR to this repo adding your entry to `registry.json`:

```json
{
  "name": "YourName",
  "repo": "yourgithub/your-subs-repo"
}
```

Optional fields:
- `"branch": "main"` — defaults to `main` if omitted
- `"url": "https://github.com/..."` — derived from `repo` if omitted

## 4. Update your subs

Just push new files to your repo. The site rebuilds every hour automatically.

## 5. Remove your listing

Submit a PR removing your entry from `registry.json`, or just delete/privatize your repo. Your entries will disappear on the next build.
