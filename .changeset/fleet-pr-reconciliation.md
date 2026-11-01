---
"@shivaedev/work-fleet": minor
"@shivaedev/pr-watch": minor
---

### Breaking

- The PR watcher `GitHub` service’s `confirmQueue` method now returns `Snapshot | undefined`. Direct callers must treat `undefined` as an unconfirmed observation and retain the last successful snapshot without emitting transitions. Custom adapters can return `undefined` to defer confirmation.

### Fixed

- Fleet reconciles tracked PRs that merged or closed while its watcher was stopped and continues watching open PRs after restart.
- Failed Fleet queue confirmations preserve the previous snapshot and defer transitions until GitHub confirms the observation.
