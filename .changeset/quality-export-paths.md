---
"@shivaedev/quality": minor
---

### Breaking

- `imports/fences/dsl.ts` moves to `imports/fence.ts`: change the import path in every `quality.fences.config.ts` and other fence importer.
- `cli/migrate.ts` moves to `cli/migrateBaseline.ts`: change the import path for `migrateBaseline`.
- `config/file.ts` moves to `config/constants.ts`: change the import path for `CONFIG_FILE`, which now shares the topic module with `DEFAULT_EXTENSIONS`.
- `imports/components.ts` moves to `imports/cyclicComponents.ts`: change the import path for `cyclicComponents`.
- `imports/fences/policy.ts` moves to `imports/fences/compilePolicy.ts`: change the import path for `compilePolicy`.
- `imports/generated.ts` moves to `imports/withoutGenerated.ts`: change the import path for `withoutGenerated`.
- `imports/glob.ts` moves to `imports/globMatcher.ts`: change the import path for `globMatcher`.
- `imports/paths.ts` moves to `imports/shortestPath.ts`: change the import path for `shortestPath`.
- `report/stale.ts` moves to `report/staleSections.ts`: change the import path for `staleSections`.
- `rules/suppressions/biome/resolve.ts` moves to `rules/suppressions/biome/resolvePackage.ts`: change the import path for `resolvePackage`.
- `rules/syntax.ts` moves to `rules/parse.ts`: change the import path for `parse`.
