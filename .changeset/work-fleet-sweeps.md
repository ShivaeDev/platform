---
"@shivaedev/work-fleet": minor
"@shivaedev/work-board": minor
---

### Added

- Board task metadata accepts a nonempty `sweep` list of repository-relative path globs, including `['*']` for all paths.
- Fleet carries sweep paths in `BoardWork` and durable Fleet records. Sweeps block new implementers, hold matching reviewed PRs on automation, prioritize their own repairs, and send held PRs through one migration repair with the sweep brief after merging.
