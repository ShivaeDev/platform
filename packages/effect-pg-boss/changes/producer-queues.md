### Added

- `Jobs.layer({ jobs: [Queue] })` registers a queue definition for producers without starting a worker. Its queue appears in health results and uses the same retry and dead-letter settings as a worker registration.
