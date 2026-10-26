---
"@shivaedev/work-fleet": minor
---

### Fixed

- Stop interrupting working agents: a turn that stays silent for `stallMinutes` now asks the orchestrator to retry in a fresh session or abandon it, and Fleet no longer steers, interrupts or continues the thread on its own.
- Read a running Codex turn's progress from its latest item instead of downloading every item of the thread on each poll.

### Breaking

- `FleetView` sessions no longer carry `steeredAt`, `interruptRequestedAt` or `interruptedAt`, and status output no longer lists Fleet stall steer or interrupt times. Read `lastProgressAt` and the `session-stalled` decision instead.
