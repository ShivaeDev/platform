---
"@shivaedev/quality": minor
---

### Added

- A rule definition may declare `depth: "deep"`, and local rules from `defineRule` may declare it the same way; every other rule is fast. `quality lint` runs only the fast rules unless the environment sets `CI`, `CLAUDE_CODE_REMOTE` is `true` or `--full` is passed, and `--fast` forces the fast set. A fast run ends with a line naming each deep rule it skipped and how to run it; a full run ends with a line naming the deep rules it checked. A fast run sets the baseline entries and exceptions of the rules it skipped aside, so they are neither stale nor loose. `baseline write`, `tighten`, `prune` and `fix` always run every rule and refuse `--fast`.

### Changed

- `effect/service-parameters` is a deep rule. A local `quality lint`, and the pre-commit hook outside a Claude Code cloud session, no longer report it; CI and `quality lint --full` still do.
- The type-checking rules that share each package's program prepare and run only the checks of the rules in the run, so a fast lint no longer pays for `effect/service-parameters`. A rule waiting for that shared walk no longer holds one of the two rule slots, and deep rules run one at a time after the others.
- The rule story kit's `gate()` runs `quality lint --full`, so a story sees deep rules' findings in every environment.
- `runQuality` and `quality` from the testing adapters no longer pass the host's `CI` variable to the run, so a story lints the same rule set on a laptop and in CI.

### Breaking

- `effect/sql-transact` and its module `@shivaedev/quality/rules/effect/sqlTransact.ts` are removed; `transact` and `invalidateOnCommit` still refuse an unowned native outer transaction at runtime. Delete its baseline entries with `quality baseline prune`, and remove any config setting that names it.
