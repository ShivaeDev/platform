---
"@shivaedev/quality": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/quality`: Resolve declared Browserslist targets, including Electron renderers, and check Biome's CSS findings against MDN compatibility data. Applications without declared targets retain the shared Baseline policy.

### Fixed

- `@shivaedev/quality`: Classify auth SQL by schema and ownership, preserve domain-event tags in stories, accept event-consuming helpers regardless of their names, retain findings for polling and real Vitest callbacks, and accept conventional authority documents.
- `@shivaedev/create-app`: Preserve the starter's declared Quality ownership facts when packing generated applications.

### Breaking

- `@shivaedev/quality`: Registry filenames no longer exclude components from checks. Declare unmodified tool-owned files with reasoned `quality.toolOwned` globs in the owning package's manifest; customized components remain checked. Direct inventory integrations replace `inventory/shadcnFiles.ts` with `inventory/toolOwnedFiles.ts`; remove the obsolete `inventory/shadcnAlias.ts` and `inventory/shadcnFolders.ts` imports and declare ownership facts instead. Auth SQL ownership now comes from configured owner table declarations or recognizable inventoried schema declarations; keep that evidence visible instead of relying on conventional table names.
