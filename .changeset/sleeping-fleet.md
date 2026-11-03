---
"@shivaedev/work-fleet": minor
---

### Changed

- Fleet uses the reconciler to wake admission, dispatch and record reconciliation on committed changes and retry deadlines. Idle Fleet sleeps between observations; GitHub and provider observations retain their own cadence.

- Observation timestamps and progress still reach readers without waking another scheduling pass.

### Breaking

- Import the scheduler's `run` from `@shivaedev/work-fleet/engine/runScheduler.ts` and replace its pause Effect with an Effect returning `{ github, provider }` observation intervals in milliseconds. Provide the same native Reactivity to the store and scheduler; the app database layer already supplies it. The host's `schedulerPause` is replaced by `schedulerCadence` in `host/commands.ts`.
- The polling `host/providerReadPause.ts` module is removed. Let `run` schedule provider observations and persisted read-retry deadlines.
