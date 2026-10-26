---
"@shivaedev/work-board": minor
---

### Added

- Keep goals with `standing: true` active as homes for new work.

### Changed

- Show done, running, blocked, scheduled and parked work in goal progress bars, excluding dropped tasks from totals and child-goal rollups.

### Breaking

- Goal projection counts now use `done`, `running`, `blocked`, `scheduled` and `parked`. Consumers of the goals RPC must read these progress states instead of authored status counts.
