# Existing debt, exceptions and commit checks

The [README](../README.md) introduces the gate. This page explains how a repository records debt, keeps it current as files change and runs the gate at commit time.

## Baseline

```jsonl
{"path":"src/legacy/sync.ts","rule":"comments/no-jsdoc","count":3}
{"path":"src/server/db.ts","rule":"structure/max-lines","count":262}
```

The baseline is a JSON Lines file with one entry per line: the violations of one rule in one file. `count` is how many violations the file may have. For a rule that counts occurrences, such as `comments/no-jsdoc`, that is the number of occurrences. For a rule with a limit, it is the amount over the limit: the entry above lets `src/server/db.ts` have 412 lines under a limit of 150. A new baseline is sorted by path and then rule. Later edits preserve unrelated lines, including their formatting and order, so the diff shows the entries that changed.

For an error-level rule, `quality lint` fails when a baselined file has more violations than its `count`; the report then lists all of that file's violations for the rule. Warning-level findings remain warnings. A file at or below its entry passes. An entry that allows more than is left, including a file with no violations left, is listed as a note and does not fail, so fixing debt never breaks the build; `tighten` and `prune` lower it. An entry for a rule that is off or unknown fails until it is pruned. The baseline covers violations at any level.

- `quality baseline write` records every error-level violation when there is no baseline yet. Once a baseline exists it refuses, unless `--rule <id>` names the rules to record: it then replaces the entries of those rules with what the files have now, and leaves every other entry as it is.
- `quality baseline tighten` lowers and removes the entries of files changed since `HEAD`, and with `--staged`, of the files staged for the next commit. It carries the entry of a file that git sees as moved to the new path. Every other line stays byte for byte.
- `quality baseline prune` does the same for every entry. It carries the entries of files moved since the merge base (see `--against` under [Command line](../README.md#command-line)), and prunes without following moves outside a git work tree.
- `quality baseline migrate` moves a baseline from the earlier JSON format, `quality/baseline.json` or the file `--from` names, to the configured file, and removes the old one. An old entry that stored a size, such as a line count, becomes that size less the rule's current limit; an entry whose file is now within the limit is dropped.

Neither `tighten` nor `prune` ever adds or raises an entry. They lower an entry to what its file has now, and remove it when that is 0. A moved file's entry keeps the lower of its old count and what the file has now. A move is seen when both of its sides are tracked, as after `git mv`; git's rename detection decides what counts as a move.

### Pre-commit

Lowering entries in the commit that fixes them keeps the baseline current without a separate cleanup. With `preCommit: { tighten: true }`, the [pre-commit hook](#pre-commit-hook) does it. A hook of the repository's own runs:

```sh
quality baseline tighten --staged && git add quality/baseline.jsonl
quality lint
```

`tighten` counts the files as they are on disk. When a commit stages only part of a file, stash the rest first (as lint-staged does), or the entry may be lowered below what the commit holds. Quality's hook leaves the entries of such a file for a later commit instead.

### Baseline growth

An error-level finding that neither the registry nor the baseline covers fails `quality lint`; that is how new debt gets noticed. The baseline itself may grow: a reviewer sees each new or raised entry in the diff and judges it. When the failing findings are debt the baseline should keep, such as the debt of a file that moved or was renamed, record the rule again with `quality baseline write --rule <id>`. The report ends with that command for the rules that failed. Then call out the baseline growth in the pull request description.

A rule enters the baseline the same way: set it to `error`, run `quality baseline write --rule <id>` and commit both.

### Changing a limit

A count depends on the configured limit, so changing a limit shifts every count of the rule. A looser limit leaves entries that allow more than is left: they pass, and `tighten` and `prune` lower them. A stricter limit can make an error-level rule's files fail `quality lint`, since each is now further over the limit. Run `quality baseline write --rule <id>` to record the rule again under the new limit, and commit it with the config change. The raised entries show in the diff, and the pull request calls them out.

## Registry

```json
[
	{
		"rule": "structure/max-lines",
		"file": "src/generated/client.ts",
		"reason": "Generated from the OpenAPI document; splitting it would mean forking the generator."
	}
]
```

An entry covers a rule's violations in one file, for good, and must say why. With a `subject`, it covers only the violations with that subject. The registry applies before the baseline. An entry that covers nothing, or names a rule that is off, unknown or takes no exceptions, fails the gate until it is removed.

## Pre-commit hook

```sh
quality hooks install
```

`quality hooks install` installs a git pre-commit hook that runs `quality hooks pre-commit` before every commit. Installing dependencies never installs it: a repository opts in by running the command, usually from the setup script each checkout runs once. Running it again is safe.

By default the hook runs `quality lint`. `preCommit` in the config adds to it:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	preCommit: { run: ["pnpm typecheck"], tighten: true },
});
```

- `run` lists shell commands that run after `lint`, one after another, from the config's folder.
- `tighten` lowers the baseline entries of the staged files before `lint`, as `quality baseline tighten --staged` does, and stages the baseline, so the commit that fixes debt also removes it from the baseline. A file with unstaged changes is counted as it is on disk, not as the commit holds it, so its entries wait for a later commit. A baseline with unstaged changes is left as it is, with a note.

After a reported lint failure or a nonzero command exit, later commands still run, so one attempt shows their results too. A config, setup or process-launch failure stops the run. `lint` and the commands check the files on disk, not only what is staged. When checks report failures, the hook blocks the commit and ends with the checks that failed and what to do next:

```text
quality: pre-commit failed: quality lint, `pnpm typecheck` (exit code 2).
help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.
```

The hook is a short script in the repository's common git directory, `.git/hooks/pre-commit`, which every worktree of the repository shares. It changes to the root of the worktree that commits, then to the config's folder in it, and runs that worktree's quality with that worktree's config, so a branch that changes the checks commits under its own rules. It runs quality the way `hooks install` ran: when that was a file inside the repository, such as a workspace's own source, it runs `node` with the same Node options on that file; otherwise it runs `node_modules/.bin/quality` in the config's folder. When that file does not exist, as in a new worktree whose dependencies are not installed yet, the hook blocks the commit and says to install them. A config file not named `quality.config.ts` is passed with `--config`.

`hooks install` never sets `core.hooksPath`, so a hooks path set for the whole machine, such as a check that calls each repository's own hook after its own, keeps working. When `core.hooksPath` is set, git runs the hook found there instead, and `hooks install` notes that the installed hook runs only when that one calls it.

A pre-commit hook that quality did not write is kept: `hooks install` warns, says how to call quality from it, and exits 0. `--force` replaces it. `quality hooks uninstall` removes quality's hook and keeps any other.
