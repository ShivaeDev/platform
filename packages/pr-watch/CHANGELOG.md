# Changelog

## Unreleased

- Add `pr-watch` for many PRs or every open PR in a repository, with ETag REST polling, quota pacing and merge queue ref observations.
- Emit JSON lines for merged, closed, conflict, dequeued, auto-merge-off, checks-failed and stuck transitions.
- Persist snapshots for clean restart comparison; transient reversed transitions are not recovered and stdout is at-least-once across a crash.
