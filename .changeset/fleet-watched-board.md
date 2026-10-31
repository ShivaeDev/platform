---
"@shivaedev/work-fleet": minor
---

### Changed

- Share Board's watched index across daemon admission, dispatch, reconciliation and responses. Board changes wake scheduling immediately, with a slow periodic safety pass and continued active-turn observation.
- Direct filesystem edits become visible to daemon reads when Board's watched index observes them.

### Breaking

- Custom hosts calling `hostScheduler` or `dispatchRequests` directly must provide `watchedBoard(root)` from `@shivaedev/work-fleet/board/watched.ts` as a shared Layer. `hostLayer` and `daemonLayer` provide it automatically.
