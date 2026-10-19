export const USAGE = `Usage:
  quality lint [--config <file>]
  quality fix [--config <file>]
  quality exceptions migrate [--config <file>] [--from <registry>]
  quality baseline merge <ancestor> <current> <other>
  quality baseline install-driver
  quality baseline write [--config <file>] [--rule <id>]...
  quality baseline prune [--config <file>] [--against <ref>]
  quality baseline tighten [--config <file>] [--staged]
  quality baseline migrate [--config <file>] [--from <file>]
  quality hooks install [--config <file>] [--force]
  quality hooks uninstall
  quality hooks status
  quality hooks pre-commit [--config <file>]

lint              Run every rule. Exits 1 on an error-level violation, a file over its baseline, a stale registry entry
                  or a baseline entry for an unknown rule.
fix               Sort every package.json, apply Biome's lint fixes, unsafe ones included, its assist actions and formatting, then format again.
exceptions migrate Move legacy registry entries and Biome declarations into quality.config.ts exceptions and remove matching root overrides.
baseline merge    Merge Git baseline versions into <current>: deletions win and counts take the minimum.
baseline install-driver Configure only the repository-local merge.quality-baseline.driver setting.
baseline write    Record current error-level violations. Creates the baseline, or records the named rules again, replacing their entries.
baseline prune    Drop fixed debt, lower entries to what is left and carry entries to files git saw move. Never adds or raises an entry.
baseline tighten  Prune only the entries of files changed since HEAD, or with --staged, in the index.
baseline migrate  Move a JSON or JSON Lines baseline (--from, quality/baseline.json by default) into root and package shards.
hooks install     Install the git pre-commit hook, shared by every worktree, that runs hooks pre-commit. Keeps a hook that is not quality's
                  unless --force replaces it.
hooks uninstall   Remove quality's pre-commit hook. Keeps a hook that is not quality's.
hooks status      Check that git's effective hooks path runs Quality's pre-commit hook and report global chaining.
hooks pre-commit  What the hook runs: lint, then package.json scripts typecheck and quality:commit when present.

--config <file>  Config file; its directory is the repository root. Without this option, uses ./quality.config.ts when present, otherwise defaults.
--against <ref>  The branch the work merges into, whose merge base prune follows moves from. Defaults to origin/HEAD, then origin/main, then origin/master.
Exit codes: 0 passed, 1 failed the gate, 2 could not run.`;

export const SUBCOMMANDS: Readonly<Record<string, string>> = {
	baseline: "baseline takes write, prune, tighten, migrate, merge or install-driver.",
	exceptions: "exceptions takes migrate.",
	hooks: "hooks takes install, uninstall, status or pre-commit.",
};
