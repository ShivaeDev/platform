---
"@shivaedev/quality": minor
"@shivaedev/create-app": minor
---

### Breaking

- Recording an existing baseline now requires `--rule <id> --file <path>`, and every selected file must be changed since `HEAD`. Replace repo-wide rule writes with explicit changed paths, repeating `--file` as needed; stage new files first. Direct callers pass selected paths as `writeBaseline`'s fourth argument. Initial adoption without a baseline still records existing debt once. For renames, use `quality baseline prune --against <base>` to carry existing counts.
- Pre-commit rejects staged baseline counts that allow more findings than remain in their files. Run `quality baseline tighten --staged` and stage the resulting baseline changes before committing a repair.

### Fixed

- Generated apps prune their copied baseline after formatting and before the initial commit, so repaired debt cannot block the strict commit gate.
- Generated app guidance shows file-scoped baseline writes and stages new files before recording their debt.
- Failing reports point moved files to baseline pruning instead of suggesting repo-wide debt recording.
