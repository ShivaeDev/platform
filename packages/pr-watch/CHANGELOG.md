# Changelog

## 0.1.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/platform-node` and `@effect/platform-node-shared` 4.0.4 alongside it.

## 0.0.1 - 2026-10-12

### Added

- Emit `queued` when a PR enters the merge queue; report `auto-merge-off` only outside the queue, including a confirmed drop with auto-merge still off.
- Report already-stuck auto-merges on the first observation and stop polling merged or closed PRs while retaining their saved snapshots.
- Confirm missing queue refs against the PR’s GraphQL queue entry and auto-merge state before reporting a drop.
- Use Effect `FileSystem` and `HttpClient` for watcher IO; service layers require these native services, and the CLI supplies them with exact `@effect/platform-node` and `@effect/platform-node-shared` peers.
- Add `pr-watch` for many PRs or every open PR in a repository, with ETag REST polling, quota pacing and merge queue ref observations.
- Emit JSON lines for merged, closed, conflict, dequeued, auto-merge-off, checks-failed and stuck transitions.
- Persist snapshots for clean restart comparison; transient reversed transitions are not recovered and stdout is at-least-once across a crash.

### Fixed

- Fleet discovery keeps open PRs tracked across failed initial observations and clean restarts, so their later merge is reported once even if the first complete snapshot arrives after merging.
