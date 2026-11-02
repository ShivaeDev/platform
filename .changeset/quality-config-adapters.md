---
"@shivaedev/quality": minor
---

### Added

- `appTestConfig` accepts `connectionBudget`, `connectionsPerWorker` and `maxWorkers` alongside coverage options, so applications can set test concurrency through the shared helper.

### Breaking

- Biome config loading moves from `rules/suppressions/biome/configs.ts` and `rules/suppressions/biome/resolvePackage.ts` to `adapters/biome/configs.ts` and `adapters/biome/resolvePackage.ts`. Import these helpers from their adapter paths. Import `syntaxOf` from `adapters/biome/syntax.ts`; pure syntax helpers remain in `biome/syntax.ts`.
