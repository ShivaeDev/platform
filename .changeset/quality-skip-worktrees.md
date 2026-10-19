---
"@shivaedev/quality": patch
---

### Fixed

- Exclude `.worktrees` directories from all Vitest projects, repository discovery and Biome checks so worktree copies are not tested or linted from the parent checkout.
