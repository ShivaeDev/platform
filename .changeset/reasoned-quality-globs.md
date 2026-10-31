---
"@shivaedev/quality": minor
"@shivaedev/create-app": minor
---

### Breaking

- Glob options (`toolOwned`, `content`, `edge`, `owners` and `suites`) require `{ glob, reason }` declarations. Replace each string with a declaration explaining its purpose, and remove patterns that match no current inventoried file. Stale declarations fail configuration.
- Lint and baseline commands refuse legacy exception registries. Run `quality exceptions migrate` (or `quality exceptions migrate --from <registry>`) to move entries into config exceptions.

### Added

- Rules can validate inventory-dependent configuration through `defineRule`'s `validate` callback before checking files.

### Changed

- Generated starters declare auth ownership with reasoned globs for Quality.

### Fixed

- Enable Biome's `noDelete` as an error while disabling its automatic fix so diagnostics remain visible without rewriting deletion behavior.
