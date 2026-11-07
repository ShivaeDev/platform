---
"@shivaedev/quality": patch
---

### Fixed

- Keep generated Biome configs in a persistent, content-addressed cache under `node_modules/.cache/quality/biome`, so interrupted or crashed runs leave no stray repository files and parallel runs use independent settings.
