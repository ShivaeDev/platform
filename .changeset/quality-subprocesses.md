---
"@shivaedev/quality": minor
---

### Fixed

- Run git inventory and generated-folder checks through the shared scoped Effect git runner so cancellation reaches their child processes.
- Return a tagged setup failure with Biome's exit code and output when a failed run supplies no usable report.

### Breaking

- Rename `git` to `run` in `git/command.ts`; change imports and calls to `run`. Remove the `Git` type alias. Use `ChildProcessSpawner.ChildProcessSpawner` from `effect/process` for service requirements.
- Move `runBiome` and `BiomeRun` from `biome/run.ts` to `adapters/biome/run.ts`; change imports to that path.
- Inventory path functions and `withoutGenerated` now return Effects instead of Promises. Compose them in Effect and provide `ChildProcessSpawner` alongside `FileSystem` for inventory collection, walking, manifest sorting and snapshots.
