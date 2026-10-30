---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- A rerun that collects a test the attempt before it did not have, or no longer collects one it had, now fails the run with a `vitest-rerun:` message instead of crashing the attempt with an unhandled rejection. The final reports keep the results of the attempt before it.
- A run no longer leaves its internal `tests.attempt-<n>.bin` snapshots in the output directory.
