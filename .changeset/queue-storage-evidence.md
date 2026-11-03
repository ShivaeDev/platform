---
"@shivaedev/quality": minor
---

### Added

- `tests/queue-readouts` reports jobs-testing `jobs` and `snapshot` storage readouts in application tests and test-support. The jobs package may test its own readouts.

### Breaking

- Quality enables `tests/queue-readouts` for every repository. Replace queue counts and job-state assertions with the application's visible results; retain jobs-testing controls and waits to drive workers.
