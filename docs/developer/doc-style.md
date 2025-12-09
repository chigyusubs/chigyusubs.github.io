# Doc Style & Placement

> **Type**: Guideline | **Status**: Stable | **Last Updated**: 2025-12-09 | **Owner**: Documentation
> **Source of truth**: Keep this file and `docs/DOCUMENTATION.md` in sync when adding or moving docs.

Use this guide to keep the docs tree consistent, searchable, and low-maintenance.

## Where things go

- **user/** — How to use the app (guides, troubleshooting, FAQs).
- **developer/** — How it works (architecture, prompts, provider abstractions, dev setup, doc style).
- **reference/** — Specs, configuration, file maps, provider matrices, tokenomics.
- **archive/** — Completed plans/migrations and deprecated docs (keep linked for history).
- **DOCUMENTATION.md** — Single index; must be updated whenever a doc is added, moved, or retired.

## Required front matter

Add a short inline header under the H1 of every doc:

```
> **Type**: [Guide | Spec | Reference | ADR | Roadmap | FAQ] | **Status**: [Draft | Stable | Deprecated] | **Last Updated**: YYYY-MM-DD | **Owner**: Team/Person
> **Source of truth**: <where to look first when reconciling changes>
```

If a doc is derived from code or another doc, point `Source of truth` there (e.g., `src/lib/providers` or `docs/developer/prompt-engineering.md`).

## Writing rules

- Prefer short, task-oriented sections; link to deeper docs instead of duplicating content.
- Avoid “coming soon” sections; either ship a minimal version or move the idea to `archive/` or an issue.
- Cross-link with relative paths; avoid absolute URLs to the repo.
- When renaming or splitting docs, update all inbound links and `DOCUMENTATION.md` in the same change.
- Keep tables narrow; prefer bullets for quickly-changing info like model lists.

## Keeping docs fresh

- Add a line to `docs/CHANGELOG.md` for notable doc structure updates.
- For feature changes, update the implementation doc **and** the corresponding design/architecture doc together.
- If a doc becomes outdated but you lack time to fix it, mark `Status: Deprecated` and point readers to the replacement.
