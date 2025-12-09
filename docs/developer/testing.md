# Testing Guide

> **Type**: Guide | **Status**: Draft | **Last Updated**: 2025-12-09 | **Owner**: Engineering  
> **Source of truth**: Package scripts (`package.json`) and test files under `src/`

Basic testing commands:
- `npm run test` — Run the Vitest suite.
- `npm run lint` — Run ESLint on the codebase.

Notes:
- Use [Mock Mode](./mock-mode.md) to exercise UI flows without consuming API quota.
- Structured output experiments live under `src/lib/structured/` and may require fixtures; see `docs/developer/structured-output.md` for context.
- When adding new features, prefer small, fast unit tests over end-to-end tests (client-only app).
