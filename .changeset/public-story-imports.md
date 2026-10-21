---
"@shivaedev/quality": patch
---

### Changed

- Let story kits import any workspace package's exported modules through package names or aliases without listing them in `tests/support-imports.options.modules`. Keep the allowlist for additional internal modules; packages without exports retain their existing boundary.
