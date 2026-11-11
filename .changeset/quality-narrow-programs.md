---
"@shivaedev/quality": minor
---

### Changed

- `effect/context-capture` type-checks only the files with a call that could re-provide a context: `provideContext`, `runPromiseWith` or `runForkWith` by name or through an import, destructured or local alias, or a `provide` whose last argument is neither a `Layer.…` expression nor a name ending in `Layer` or `Live` or named `layer`. It builds a program rooted at those files instead of joining the package walk, so a lint takes less time and memory. A runner re-exported under another name through a local module is no longer seen.
- `effect/service-model` builds a program rooted at the files that call `defineService` instead of joining the package walk; TypeScript loads the operation files they import.

### Breaking

- `suppressions/biome-recommended` is removed, together with the modules `@shivaedev/quality/rules/suppressions/biomeRecommended.ts`, `@shivaedev/quality/biome/recommendedRules.ts` and `@shivaedev/quality/adapters/biome/presetConfig.ts`. It only checked Quality's own shipped preset, which Quality's test suite now checks against the installed Biome. Delete its baseline entries with `quality baseline prune`; a config that still names it under `rules` is refused with "no built-in or local rule has this id", so remove that setting.
