---
"@shivaedev/pr-watch": minor
---

### Added

- Configure quiet heartbeats with `--heartbeat SECONDS` (default 900; `0` disables heartbeats).

### Changed

- Emit heartbeats after a quiet period across polling rounds; every stdout line resets the period. Report quota cooldowns, errors and stops immediately.
- Keep watching when a PR's mergeability is pending: retain its previous snapshot or discovery-only tracking, skip its output and observe it again next round while other PRs continue.

### Breaking

- `GitHub.snapshot` returns `undefined` for pending mergeability instead of failing. Consumers must skip that PR's snapshot replacement and observe it again next round.
- Replace direct `waitForPoll` calls with `makeOutput(emit, heartbeatMilliseconds)` and route PR lines through its `emit` method and waits through its `waitForPoll` method so quiet time spans rounds.
