---
"@shivaedev/vitest-rerun": minor
---

### Added

- Timed JSON file results include `projectName` and `relativePath` so timing consumers can identify executed files across projects and machines.

### Breaking

- Callers of `internal/writeTimedReport.ts` pass `{ durationMs, projectName, relativePath }` records instead of duration numbers.
