---
"@shivaedev/pr-watch": minor
---

### Added

- `pr-watch wait --repo OWNER/REPO NUMBER` blocks until one pull request has a result (checks passed, a check failed, conflict, removed from the merge queue, merged or closed), prints it as one JSON line and exits with that result's code. It follows the PR through the merge queue, writes at most one progress line a minute to stderr, stops with exit code 7 after `--timeout SECONDS` and resumes from its state file on a second run. `waitFor` runs the same wait from code.
- Snapshots record the PR's mergeable state and, when a required check failed, the failing checks with their Actions run ids.

### Breaking

- `checkFailures` returns the failing checks instead of a boolean: an empty list when no required check failed, every failing check run and commit status when one did, and `undefined` while required flags are incomplete. Replace a `true` test with a non-empty list check.
