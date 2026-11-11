---
"@shivaedev/quality": minor
---

### Added

- The `biome` rule runs the Biome rules that need its project scanner, those of Biome's `project` and `types` domains such as `noFloatingPromises`, `noUndeclaredDependencies` and `useTailwindSortedClasses`, as its scanner half, in CI and with `quality lint --full`. A fast run's Biome turns them off and runs without the scanner, which takes its memory from 1.1 to 1.2 GB to about 0.4 GB in Quality's own repository, names `biome scanner half` in its closing line and sets aside the exceptions that name those rules. A fast run and the scanner half together report exactly what the rule reported before. A local `quality lint`, and so the default commit hook, no longer reports findings of those rules; they fail in CI or with `quality lint --full`. Only a commit hook with `preCommit: "staged"`, which runs Biome's full config on the staged files, still reports them on commit.
- Baseline entries for Biome findings record the scanner half's share as `deep`, as for the other split rules. Run `quality baseline prune` once, as a full run reminds you to, so a fast run judges existing Biome entries exactly instead of as upper bounds.

### Changed

- A lint starts Biome and Knip before the rules that run in Quality's own process, so their child processes no longer start late and hold up the end of the run.
- `quality lint` judges Biome exceptions from its one Biome run, which reports the declared rules and sets their findings aside, instead of a second Biome run over the declared files.
