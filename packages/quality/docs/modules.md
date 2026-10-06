# Module reference

The `./*.ts` export pattern maps each module below to its emitted JavaScript and declarations, with source selected under the `source` condition. Import a symbol from its defining module. The [README](../README.md#api) explains the config and extension APIs; this table also makes the implementation modules exposed by that pattern findable.

A module link opens its source. Type and value declarations with the same name appear once. `cli.ts` is the executable entry and has no exported symbols.

## Top-level modules

| Module | Exported names |
| --- | --- |
| [cli.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli.ts) | None; executable entry. |
| [config.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/config.ts) | `Level`, `RuleSetting`, `RuleSettings`, `BuiltInRules`, `PreCommit`, `QualityConfig`, `defineConfig` |
| [decoded.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/decoded.ts) | `Decoded`, `decodeWith`, `validOrFail` |
| [failure.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/failure.ts) | `SetupFailure`, `GateFailed` |
| [rule.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rule.ts) | `Finding`, `Findings`, `SourceFile`, `RuleInputs`, `RuleContext`, `Configured`, `Rule`, `defineRule` |
| [standard-schema.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/standard-schema.ts) | `StandardSchemaV1`, `StandardResult`, `StandardIssue`, `describeIssue` |
| [vitest.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/vitest.ts) | `testProjects`, `inheritTags` |

## baseline

| Module | Exported names |
| --- | --- |
| [baseline/compare.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/baseline/compare.ts) | `Regression`, `StaleBaselineEntry`, `BaselineCheck`, `countOf`, `applyBaseline` |
| [baseline/format.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/baseline/format.ts) | `BaselineEntry`, `byPathAndRule`, `linesOf`, `decodeBaseline`, `encodeEntry`, `encodeBaseline` |
| [baseline/legacy.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/baseline/legacy.ts) | `LEGACY_BASELINE`, `LegacyEntry`, `decodeLegacyBaseline`, `convertLegacy` |
| [baseline/rewrite.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/baseline/rewrite.ts) | `rewriteBaseline` |
| [baseline/update.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/baseline/update.ts) | `Adoption`, `Pruned`, `adopt`, `Scope`, `prune` |

## biome

| Module | Exported names |
| --- | --- |
| [biome/recommendedRules.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/biome/recommendedRules.ts) | `recommendedRules` |
| [biome/report.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/biome/report.ts) | `Diagnostic`, `Report`, `biomeReport` |
| [biome/run.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/biome/run.ts) | `BiomeRun`, `runBiome` |

## cli

| Module | Exported names |
| --- | --- |
| [cli/args.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/args.ts) | `Command`, `Parsed`, `USAGE`, `parseCommand` |
| [cli/baseline.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/baseline.ts) | `writeBaseline`, `shrinkBaseline` |
| [cli/fix.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/fix.ts) | `MAX_FIX_ROUNDS`, `snapshotOf`, `Pass`, `Settling`, `settle`, `fix` |
| [cli/lint.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/lint.ts) | `lint` |
| [cli/migrate.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/migrate.ts) | `migrateBaseline` |
| [cli/run-main.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/run-main.ts) | `quietOnClosedPipe`, `runMain` |
| [cli/shrink.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/cli/shrink.ts) | `pruneBaseline`, `tightenBaseline` |

## config

| Module | Exported names |
| --- | --- |
| [config/decode.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/config/decode.ts) | `ConfigInput`, `decodeConfig` |
| [config/file.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/config/file.ts) | `CONFIG_FILE` |
| [config/load.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/config/load.ts) | `ResolvedConfig`, `loadConfig` |
| [config/resolve.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/config/resolve.ts) | `ResolvedRules`, `resolveRules` |

## engine

| Module | Exported names |
| --- | --- |
| [engine/baseline-file.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/engine/baseline-file.ts) | `BaselineFile`, `readInput`, `readBaseline` |
| [engine/evaluate.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/engine/evaluate.ts) | `Outcome`, `evaluate`, `passes` |
| [engine/run-rules.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/engine/run-rules.ts) | `ActiveRule`, `runRules` |
| [engine/session.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/engine/session.ts) | `Session`, `scan`, `openSession` |
| [engine/violation.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/engine/violation.ts) | `ActiveLevel`, `Violation`, `keyOf`, `byLocation`, `groupBy`, `RuleIndex`, `covers`, `levelOf`, `registrable`, `unusedEntryProblem` |

## exceptions

| Module | Exported names |
| --- | --- |
| [exceptions/registry.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/exceptions/registry.ts) | `RegistryEntry`, `decodeRegistry`, `StaleRegistryEntry`, `RegistryCheck`, `applyRegistry` |

## git

| Module | Exported names |
| --- | --- |
| [git/base.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/git/base.ts) | `Base`, `resolveBase` |
| [git/command.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/git/command.ts) | `GitResult`, `Git`, `git`, `gitOrFail` |
| [git/history.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/git/history.ts) | `Changes`, `changesSince` |

## hooks

| Module | Exported names |
| --- | --- |
| [hooks/command.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/command.ts) | `Launch`, `HookCommand`, `hookCommand`, `commandWords`, `shellWords` |
| [hooks/install.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/install.ts) | `HookInstall`, `installHook` |
| [hooks/location.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/location.ts) | `HookLocation`, `hookLocation` |
| [hooks/preCommit.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/preCommit.ts) | `preCommitHook` |
| [hooks/shim.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/shim.ts) | `isHookShim`, `hookShim` |
| [hooks/uninstall.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/hooks/uninstall.ts) | `uninstallHook` |

## imports

| Module | Exported names |
| --- | --- |
| [imports/ambient.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/ambient.ts) | `Ambient`, `ambientModules` |
| [imports/components.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/components.ts) | `cyclicComponents` |
| [imports/departures.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/departures.ts) | `Departure`, `departures` |
| [imports/extract.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/extract.ts) | `ImportKind`, `ImportRequest`, `importsOf` |
| [imports/generated.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/generated.ts) | `withoutGenerated` |
| [imports/glob.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/glob.ts) | `globMatcher` |
| [imports/graph.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/graph.ts) | `ImportEdge`, `UnresolvedImport`, `ImportGraph`, `importGraph` |
| [imports/paths.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/paths.ts) | `shortestPath` |
| [imports/pnpm-workspace.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/pnpm-workspace.ts) | `pnpmWorkspacePatterns` |
| [imports/projects.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/projects.ts) | `Project`, `projectsFor` |
| [imports/resolve.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/resolve.ts) | `Endpoint`, `builtinName`, `packageNameOf`, `isDeclarationFile`, `presumedTarget`, `resolveImport` |
| [imports/specifiers.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/specifiers.ts) | `SpecifierSite`, `specifierSites` |
| [imports/workspace.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/workspace.ts) | `WorkspacePackage`, `workspacePackages`, `packageOf` |

## imports/fences

| Module | Exported names |
| --- | --- |
| [imports/fences/dsl.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/dsl.ts) | `fence` |
| [imports/fences/evaluate.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/evaluate.ts) | `FenceGraph`, `Evaluate`, `CompiledFence`, `compileFence` |
| [imports/fences/match.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/match.ts) | `PolicyScope`, `Matcher`, `Compiler`, `trimmed`, `holdsFiles`, `packageNamed`, `compile` |
| [imports/fences/model.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/model.ts) | `Selector`, `Target`, `External`, `ExampleStep`, `Chain`, `Examples`, `Prohibition`, `Fence` |
| [imports/fences/policy.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/policy.ts) | `compilePolicy` |
| [imports/fences/reach.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/reach.ts) | `Reached`, `labelOf`, `outgoing`, `reachedFrom` |
| [imports/fences/selectors.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/selectors.ts) | `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace`, `anything`, `external` |
| [imports/fences/vocabulary.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/imports/fences/vocabulary.ts) | `Vocabulary`, `compileVocabulary` |

## inventory

| Module | Exported names |
| --- | --- |
| [inventory/collect.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/inventory/collect.ts) | `InventoryScope`, `Inventory`, `linesOf`, `collectInventory` |
| [inventory/filesystem.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/inventory/filesystem.ts) | `FilesystemFailure`, `orWhenAbsent`, `readOptionalText`, `readRequiredText`, `writeText` |
| [inventory/ignore-scope.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/inventory/ignore-scope.ts) | `Verdict`, `IgnoreScope`, `emptyScope`, `posix`, `withIgnoreFile`, `insideKept`, `verdictFor` |
| [inventory/walk.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/inventory/walk.ts) | `ignoreScopeAt`, `scopeAbove`, `walk` |

## manifests

| Module | Exported names |
| --- | --- |
| [manifests/sorted.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/manifests/sorted.ts) | `Sorting`, `manifestsIn`, `sortingOf`, `sortManifests` |

## naming

| Module | Exported names |
| --- | --- |
| [naming/exportFits.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/exportFits.ts) | `exportFits` |
| [naming/mainExport.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/mainExport.ts) | `mainExport` |
| [naming/ownExports.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/ownExports.ts) | `OwnExport`, `ownExports` |
| [naming/packageLayout.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/packageLayout.ts) | `PackageLayout`, `packageLayout` |
| [naming/testName.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/testName.ts) | `ENVIRONMENTS`, `Environment`, `TestName`, `testName`, `isTestSupport`, `isTestCode` |
| [naming/words.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/naming/words.ts) | `KEBAB`, `CAMEL`, `PASCAL`, `wordsOf`, `singular`, `sameWord`, `isUpper` |

## report

| Module | Exported names |
| --- | --- |
| [report/plural.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/report/plural.ts) | `plural` |
| [report/render.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/report/render.ts) | `WarningDetail`, `ReportContext`, `render` |
| [report/stale.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/report/stale.ts) | `staleSections` |

## rules

| Module | Exported names |
| --- | --- |
| [rules/biome.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/biome.ts) | `PRESET`, `rootConfig`, `biome` |
| [rules/built-in.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/built-in.ts) | `builtInRules` |
| [rules/manifests-sorted.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/manifests-sorted.ts) | `manifestsSorted` |
| [rules/max-lines.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/max-lines.ts) | `maxLines` |
| [rules/syntax.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/syntax.ts) | `parse` |

## rules/comments

| Module | Exported names |
| --- | --- |
| [rules/comments/kinds.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/kinds.ts) | `Pragmas`, `textOf`, `isJsdoc`, `isPragma`, `isDirective` |
| [rules/comments/max-per-file.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/max-per-file.ts) | `maxPerFile` |
| [rules/comments/no-banner.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-banner.ts) | `noBanner` |
| [rules/comments/no-environment-pragma.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-environment-pragma.ts) | `noEnvironmentPragma` |
| [rules/comments/no-jsdoc.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-jsdoc.ts) | `noJsdoc` |
| [rules/comments/no-line-reference.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-line-reference.ts) | `noLineReference` |
| [rules/comments/no-pr-reference.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-pr-reference.ts) | `noPrReference` |
| [rules/comments/no-todo.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/no-todo.ts) | `noTodo` |
| [rules/comments/pattern-rule.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/pattern-rule.ts) | `definePatternRule` |
| [rules/comments/scan.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/comments/scan.ts) | `SourceComment`, `bodyOf`, `scanComments`, `commentsOf` |

## rules/files

| Module | Exported names |
| --- | --- |
| [rules/files/folderNames.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/files/folderNames.ts) | `folderNames` |
| [rules/files/namedAfterExport.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/files/namedAfterExport.ts) | `namedAfterExport` |
| [rules/files/otherNames.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/files/otherNames.ts) | `otherNames` |
| [rules/files/packageImports.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/files/packageImports.ts) | `PackageImports`, `packageImports` |
| [rules/files/stylesheetImporters.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/files/stylesheetImporters.ts) | `stylesheetImporters` |

## rules/imports

| Module | Exported names |
| --- | --- |
| [rules/imports/aliased.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/imports/aliased.ts) | `importsAliased` |
| [rules/imports/cycles.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/imports/cycles.ts) | `importCycles` |
| [rules/imports/fences.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/imports/fences.ts) | `importFences` |
| [rules/imports/resolvable.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/imports/resolvable.ts) | `importsResolvable` |

## rules/stories

| Module | Exported names |
| --- | --- |
| [rules/stories/fixtureWrites.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/stories/fixtureWrites.ts) | `FixtureWrite`, `fixtureWrites` |
| [rules/stories/setup.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/stories/setup.ts) | `storySetup` |

## rules/suppressions

| Module | Exported names |
| --- | --- |
| [rules/suppressions/biome-overrides.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome-overrides.ts) | `biomeOverrides` |
| [rules/suppressions/biomeRecommended.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biomeRecommended.ts) | `biomeRecommendedFrom`, `biomeRecommended` |
| [rules/suppressions/directives.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/directives.ts) | `SUPPRESSIONS`, `suppressionIn` |
| [rules/suppressions/no-double-cast.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/no-double-cast.ts) | `noDoubleCast` |
| [rules/suppressions/no-inline.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/no-inline.ts) | `noInline` |
| [rules/suppressions/noIgnoreDeprecations.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/noIgnoreDeprecations.ts) | `noIgnoreDeprecations` |
| [rules/suppressions/stylesheet-comments.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/stylesheet-comments.ts) | `STYLESHEET`, `stylesheetComments` |

## rules/suppressions/biome

| Module | Exported names |
| --- | --- |
| [rules/suppressions/biome/configs.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome/configs.ts) | `Preset`, `Layer`, `Chain`, `BiomeConfigs`, `biomeConfigs` |
| [rules/suppressions/biome/declarations.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome/declarations.ts) | `Declaration`, `PRESET_DECLARATIONS`, `decodeShipped`, `Scoped`, `matches`, `scoped`, `scopeText` |
| [rules/suppressions/biome/json.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome/json.ts) | `Json`, `Parsed`, `parseJsonc`, `member`, `entriesOf`, `itemsOf`, `textOf`, `isFalse` |
| [rules/suppressions/biome/resolve.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome/resolve.ts) | `resolvePackage` |
| [rules/suppressions/biome/weakenings.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/suppressions/biome/weakenings.ts) | `Weakening`, `weakeningsOf` |

## rules/test-names

| Module | Exported names |
| --- | --- |
| [rules/test-names/colocated.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/test-names/colocated.ts) | `testsColocated` |
| [rules/test-names/follow.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/test-names/follow.ts) | `testsFollow` |
| [rules/test-names/usesDom.ts](https://github.com/ShivaeDev/platform/blob/main/packages/quality/src/rules/test-names/usesDom.ts) | `usesDom` |

## Preset assets

| Package path | File |
| --- | --- |
| `@shivaedev/quality/biome` | `biome/preset.json` |
| `@shivaedev/quality/tsconfig/base.json` | `tsconfig/base.json` |
| `@shivaedev/quality/tsconfig/package.json` | `tsconfig/package.json` |
| `@shivaedev/quality/package.json` | Package metadata |

The [shared tooling guide](./tooling.md) explains how to use the presets.
