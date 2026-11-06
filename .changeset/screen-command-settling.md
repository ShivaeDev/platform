---
"@shivaedev/contract": minor
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/contract`: Activity reports commands in flight and mounted queries awaiting their first result. `isClientSettled` checks these counts using the contract's command metadata.

### Breaking

- `@shivaedev/contract`: Screen signals from `activityScreenSignal(activity)` now settle on commands and first query results, allowing live queries to remain open or await later refreshes. Code constructing `ClientActivityState` values must supply `commands` and `initialQueries`. To retain full finite-work settling, pass `isClientIdle` as the second argument. Start `nextLiveHint()` before an outside write when a story needs its next live change, then settle through that refresh with the full idle signal.
- `@shivaedev/test-story`: Screen drivers using the default contract activity signal wait for commands and first query results. Use `activityScreenSignal(activity, isClientIdle)` for stories that need full finite-work settling, and start `nextLiveHint()` before the outside write when waiting for a live change.
