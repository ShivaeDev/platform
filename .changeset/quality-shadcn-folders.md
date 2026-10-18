---
"@shivaedev/quality": patch
---

### Changed

- Treat the UI folder named by each app's `components.json` as shadcn-owned by default. Quality's source rules and Biome lint, formatting and fixes skip that folder without app-specific exceptions; TypeScript's inputs stay unchanged.
