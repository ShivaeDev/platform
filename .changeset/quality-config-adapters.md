---
"@shivaedev/quality": minor
---

### Added

- `appTestConfig` accepts `connectionBudget`, `connectionsPerWorker` and `maxWorkers` alongside coverage options, so applications can set test concurrency through the shared helper.

### Breaking

- Biome config loading moves from `rules/suppressions/biome/configs.ts` and `rules/suppressions/biome/resolvePackage.ts` to `adapters/biome/configs.ts` and `adapters/biome/resolvePackage.ts`. Import these helpers from their adapter paths. Import `syntaxOf` from `adapters/biome/syntaxOf.ts`; pure syntax helpers remain in `biome/syntax.ts`.
- `rootConfig` and `PRESET` move from `rules/biome.ts` to `adapters/biome/rootConfig.ts`. Import `withExceptionConfig` from `adapters/biome/withExceptionConfig.ts` and `parseConfig` / `relocateConfig` from `adapters/biome/relocateConfig.ts`. Pure exception configuration remains in `biome/exceptionConfig.ts`.
- `withoutEntryPointImports`, `missingBiomeFiles`, `packageLayout`, `packageImports` and `stylesheetImporters` now return Effects. Compose them with `yield*` instead of awaiting them. Pass `{ readText }` to `withoutEntryPointImports` instead of the reader callback. `biomeRecommendedFrom` now takes a callback returning an Effect; wrap Promise-based providers with `Effect.promise`.
