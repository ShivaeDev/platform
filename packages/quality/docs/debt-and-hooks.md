# Existing debt, exceptions and commit checks

The [README](../README.md) introduces the gate. This page explains how the baseline records debt, how exceptions are applied and how the pre-commit hook runs.

## Baseline

```jsonl
{"path":"src/legacy/sync.ts","rule":"comments/no-jsdoc","count":3}
{"path":"src/server/db.ts","rule":"structure/max-lines","count":262}
```

The baseline is sharded: `packages/<package>/quality-baseline.jsonl` holds paths inside that package, and the root `quality-baseline.jsonl` holds all other paths. Packages without entries have no file. Each shard is JSON Lines with one entry per line: the violations of one rule in one file. `count` is how many violations the file may have. For a rule that counts occurrences, such as `comments/no-jsdoc`, that is the number of occurrences. For a rule with a limit, it is the amount over the limit: the entry above lets `src/server/db.ts` have 412 lines under a limit of 150. A new baseline is sorted by path and then rule. Later edits preserve unrelated lines, including their formatting and order, so the diff shows the entries that changed.

`quality lint` fails when a baselined file has more violations than its `count`; the report then lists all of that file's violations for the rule. A file at or below its entry passes. An entry that allows more than is left, including a file with no violations left, is listed as a note and does not fail, so fixing debt never breaks the build; `tighten` and `prune` lower it. An entry for an unknown rule fails until it is pruned.
- `quality baseline write` records every error-level violation when there is no baseline yet. Once a baseline exists it refuses, unless `--rule <id>` names the rules to record: it then replaces the entries of those rules with what the files have now, and leaves every other entry as it is.
- `quality baseline tighten` lowers and removes the entries of files changed since `HEAD`, and with `--staged`, of the files staged for the next commit. It carries the entry of a file that git sees as moved to the new path. Every other line stays byte for byte.
- `quality baseline prune` does the same for every entry. It carries the entries of files moved since the merge base (see `--against` under [Command line](../README.md#command-line)), and prunes without following moves outside a git work tree.
- `quality baseline migrate` moves a baseline from the earlier JSON format, `quality/baseline.json` or the file `--from` names, to the root and package shards, and removes the old one. `--from quality/baseline.jsonl` splits a single JSON Lines baseline without changing its counts. An old entry that stored a size, such as a line count, becomes that size less the rule's current limit; an entry whose file is now within the limit is dropped.

Neither `tighten` nor `prune` ever adds or raises an entry. They lower an entry to what its file has now, and remove it when that is 0. A moved file's entry keeps the lower of its old count and what the file has now. A move is seen when both of its sides are tracked, as after `git mv`; git's rename detection decides what counts as a move.

Git merges shards through the driver described in the [README](../README.md#baseline-merges). `quality baseline install-driver` configures the current checkout; deletions win and retained counts take the minimum.

### Pre-commit

Lowering entries in the commit that fixes them keeps the baseline current. Run these commands explicitly before committing:

```sh
quality baseline tighten --staged
git add -- '**/quality-baseline.jsonl' quality-baseline.jsonl
quality lint
```

`tighten` counts the files as they are on disk. When a commit stages only part of a file, stash the rest first (as lint-staged does), or the entry may be lowered below what the commit holds.

### Baseline growth

An error-level finding that neither the config exceptions nor the baseline covers fails `quality lint`; that is how new debt gets noticed. The baseline itself may grow: a reviewer sees each new or raised entry in the diff and judges it. When the failing findings are debt the baseline should keep, such as the debt of a file that moved or was renamed, record the rule again with `quality baseline write --rule <id>`. The report ends with that command for the rules that failed. Then call out the baseline growth in the pull request description.

### Counts after a policy change

A count depends on the rule's limit, so a Quality policy change that adjusts a limit shifts every count of that rule. A looser limit leaves entries that allow more than is left: they pass, and `tighten` and `prune` lower them. A stricter limit can make an error-level rule's files fail `quality lint`, since each is now further over the limit. Inspect the findings under the new policy before recording retained debt again with `quality baseline write --rule <id>`. Commit the counts with the policy upgrade. The raised entries show in the diff, and the pull request calls them out.

## Exceptions

Permanent exceptions live in `quality.config.ts`'s `exceptions`, as the [README](../README.md#configuration-limits) shows. One entry names `files`, `rules` and one `reason`; it can cover both Quality and Biome rules on the same file. Paths are explicit, relative to the config folder. A Quality exception can add `subject` to cover only that finding's subject. Rules that refuse exceptions still refuse them. Quality exceptions apply before the baseline and must cover a current finding; unknown rules, refused rules and stale entries fail the gate. Biome declarations permit individual lint rules and assist actions on explicit files, without a subject. A Biome declaration naming a missing file fails too.

Quality merges the native Biome overrides into a temporary config beside the root config, preserving the repository's settings, preset and plugins, and removes the temporary file after the command. Both `quality lint` and `quality fix` use it. Keep `biome.json` free of consumer exception settings; a manual weakening is still reported. Direct editor or Biome commands use the checked-in config; run Quality to apply its exceptions.

For a generated directory exclusion, use `rules: ["biome/files/includes"]` and `files: ["**", "!**/test-support/generated"]`. Each negative pattern names a concrete directory: it may start with `**/` and use `*` for an intermediate directory, as in `!**/test-support/*/generated`; file patterns, nested `**` and wildcard suffixes are rejected.

A package that ships its own Biome preset declares the weakenings the preset makes in a `declarations.json` beside the preset file, as an array of `{ rule, includes, reason }` entries, so a repository that extends it adds nothing for them. Quality's own preset ships its reasons this way.

### Upgrade existing exceptions

```sh
quality exceptions migrate
quality fix
quality lint
```

The command reads the legacy registry (the configured `registry` path, or `quality/registry.json`) and `suppressions/biome-overrides.options.declared`. It moves them into `exceptions`, merges declarations with the same files, reason and subject, deletes the old registry and removes the old rule setting and matching root Biome settings. It keeps other config properties. `--from <registry>` selects another legacy registry and `--config <file>` selects a config. Without a config it creates one.

Export an object or `defineConfig({ ... })` without spreads for automatic editing; inline the `rules` object when it contains old Biome declarations. Literal computed keys such as `["exceptions"]` are supported; replace dynamic computed keys with literal keys before migrating. Unsupported shapes fail before any writes. Review the diff and remove unused declaration imports and files. For declarations of settings in nested or extended local Biome configs, remove those settings too; automatic removal covers the root `biome.json` and `biome.jsonc`. Legacy readers keep existing consumers running during upgrades; new exceptions go in `exceptions`.

## Pre-commit hook

`quality hooks install` installs a git pre-commit hook that runs `quality hooks pre-commit` before every commit: `quality lint`, then the `typecheck` script, then an optional `quality:commit` script, as the [README](../README.md) describes. A repository opts in by running the command, usually from the setup script each checkout runs once. Running it again is safe.

Scripts run from the config's folder, or the current directory when there is no config. Without a manifest or either script, the hook runs lint alone. An invalid manifest stops the run. Baseline tightening is an explicit command; the hook does not change or stage debt records.

After a reported lint failure or a nonzero command exit, later commands still run, so one attempt shows their results too. A config, setup or process-launch failure stops the run. `lint` and the commands check the files on disk, not only what is staged. When checks report failures, the hook blocks the commit and ends with the checks that failed and what to do next:

```text
quality: pre-commit failed: quality lint, `pnpm run typecheck` (exit code 2).
help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.
```

The hook is a short script in the repository's common git directory, `.git/hooks/pre-commit`, which every worktree of the repository shares. It changes to the root of the worktree that commits, then to the config's folder in it, and runs that worktree's quality with that worktree's config, so a branch that changes the checks commits under its own rules. It runs quality the way `hooks install` ran: when that was a file inside the repository, such as a workspace's own source, it runs `node` with the same Node options on that file; otherwise it runs `node_modules/.bin/quality` in the config's folder. When that file does not exist, as in a new worktree whose dependencies are not installed yet, the hook blocks the commit and says to install them. A config file not named `quality.config.ts` is passed with `--config`.

`hooks install` sets repository-local `core.hooksPath` and prints that path. Without a global hooks path, it uses the common git directory's `hooks` folder. With a global `core.hooksPath`, it uses `hooks/quality`, whose forwarding hooks preserve every Git hook in the global directory, including hooks added later, with its arguments, stdin and exit status. It never changes global or system git configuration. At commit time, Quality's pre-commit shim reads global `core.hooksPath` and runs its executable `pre-commit` hook from the committing worktree's root, before Quality's checks. Relative global paths resolve from that root; a global path pointing to Quality's own hook is not chained. A re-entry marker prevents a global hook that chains `.git/hooks/pre-commit` from running Quality recursively. Quality still runs when the global hook fails, and either failure blocks the commit. Installation reports whether there is an executable global pre-commit hook to chain.

`quality hooks status` reports whether git's effective hooks path runs an executable Quality pre-commit hook, and exits 1 with an installation hint when it does not. It also reports global chaining when Quality is active. A local hooks path that runs Quality but hides other global hooks fails status with a `quality hooks install` repair hint; reinstalling replaces that layout with forwarding hooks.

A pre-commit hook that quality did not write is kept: `hooks install` warns, says how to call quality from it, and exits 0 without setting the hooks path. `--force` replaces it. `quality hooks uninstall` removes quality's hook and keeps any other. It removes Quality's forwarding hooks. It removes the repository-local hooks path only when that setting still points to one of Quality's hooks directories, letting global hooks take effect again.
