# Changelog

## 0.2.0 - 2026-10-30

### Added

- Export every engine module through the package's existing `.ts` wildcard, including modules under `internal/` in `test` and `vitest-rerun` and `server/internal/` in `test-story` and `test-sql`, so downstream kits can reuse them directly. Importing the rerun worker leaves test execution to its direct launch.

### Fixed

- Decode snapshots and timed JSON reports before using them, reporting malformed files as typed errors that name the file. Read and write timed reports through Effect FileSystem.
- A rerun that collects a test the attempt before it did not have, or no longer collects one it had, now fails the run with a `vitest-rerun:` message instead of crashing the attempt with an unhandled rejection. The final reports keep the results of the attempt before it.
- A run no longer leaves its internal `tests.attempt-<n>.bin` snapshots in the output directory.

## 0.1.3 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.1.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.1.1 - 2026-10-24

### Changed

- Align published dependency and peer pins and the generated starter with React and React DOM 19.3.1, TanStack Router 1.170.45, Better Auth 1.7.10, happy-dom 21.0.3 and Vitest 5.0.5. The starter also uses pg-boss dashboard 1.12.1.

## 0.1.0 - 2026-10-18

### Added

- Add the `vitest-rerun` command, which runs Vitest with retries off and reruns only the failed tests in a fresh process, up to `--reruns` times (default 1), while the final JSON, JUnit and coverage reports describe the whole run.
- Write `flaky-tests.json` whenever a test fails and then passes, with each test's JUnit `classname` and `name`, its file, its attempt count and the messages of its failed attempts; read it with the `FlakyTests` schema from `flakyTests.ts`.
- Name the Vitest project in the JUnit `classname`, so a file that runs in two projects keeps a distinct identity in each.
