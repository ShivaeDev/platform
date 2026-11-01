---
"@shivaedev/vitest-rerun": minor
---

### Fixed

- Judge coverage thresholds against merged coverage, preserve rerun unhandled errors in JUnit and snapshot totals and coverage in JSON, and remove attempt snapshots when a run is interrupted.

### Breaking

- Code constructing `Snapshot` values for the exported internal merge API must supply `summary` with Vitest's snapshot summary. The runner creates this field automatically.
