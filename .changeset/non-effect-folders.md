---
"@shivaedev/quality": minor
---

### Added

- Declare deliberately non-Effect subsystems with `nonEffectFolders` in Quality config. All `effect/*` rules and Effect-specific Biome plugins are off in those folders and their descendants; other rules and Effect importers remain checked. The declaration applies to the gate and Biome fix passes without adding baseline debt.
