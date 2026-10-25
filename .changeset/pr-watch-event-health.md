---
"@shivaedev/pr-watch": minor
---

### Added

- Select PR transitions with `--events KIND,...`; reject unknown kinds at startup with the valid choices.
- Print unfiltered JSON health lines for heartbeats, errors, quota cooldowns and polling stops on stdout.

### Fixed

- Keep long quota-paced waits visible with interval heartbeats and the next poll time instead of silently sleeping.
- Exit non-zero after a failed round instead of swallowing the error and retrying indefinitely; retain successful snapshots and report rate-limit retry times.
- Keep rate-limit logs out of the CLI's JSON-line stdout stream.
