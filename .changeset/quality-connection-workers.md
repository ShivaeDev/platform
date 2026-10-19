---
"@shivaedev/quality": patch
---

### Changed

- `testProjects()` sizes workers from a connection budget instead of CPU capacity. Set `connectionBudget` and `connectionsPerWorker` to match the repository's PostgreSQL usage, or set `maxWorkers` to override the calculation.
