---
"@shivaedev/quality": minor
---

### Changed

- Store baseline debt in package shards and a root `quality-baseline.jsonl`, remove empty shards, and keep tighten, prune and lint on the same records. Migrate a single-file baseline with `quality baseline migrate --from quality/baseline.jsonl`.
- Merge baseline entries by path and rule: removals win, retained counts take the minimum and additions from both sides survive. Configure the checkout with `quality baseline install-driver` and register `merge=quality-baseline` for shard files in `.gitattributes`. The source exports are `mergeBaseline(base, ours, theirs)` in `baseline/merge.ts`, `installDriver(cwd, launch)` in `baseline/installDriver.ts`, and `SHARD_NAME`, `Shard`, `shardOf(file, rootFile)`, `shardPaths(config)` and `saveShards(config, before, entries)` in `baseline/shards.ts`.

### Breaking

- `BaselineFile` from `engine/baselineFile.ts` exposes `files: ReadonlyMap<string, Shard>` instead of a single `raw` string. Read each shard's `raw` and `entries` from `files`; the combined `entries` field remains available.
