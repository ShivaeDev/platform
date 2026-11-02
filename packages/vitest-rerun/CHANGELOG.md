# Changelog

## 0.3.0 - 2026-11-02

### Fixed

- Refuse per-test and per-suite Vitest retries after each attempt, naming every affected file and test. Use `--reruns` for global fresh-process retries whose recoveries are recorded in `flaky-tests.json`.
- Rerun a file in full when its `beforeAll` or `afterAll` fails, including nested suite hooks. Keep unresolved hook diagnostics and new failures in the merged results.
- Judge coverage thresholds against merged coverage, preserve rerun unhandled errors in JUnit and snapshot totals and coverage in JSON, and remove attempt snapshots when a run is interrupted.
- Refuse reruns that change a test name, suite name or task kind at the same Vitest ID, preserving the earlier final reports instead of reporting a false recovery.

### Breaking

- Code constructing `Snapshot` values for the exported internal merge API must supply `summary` with Vitest's snapshot summary. The runner creates this field automatically.

## 0.2.1 - 2026-11-01

### Fixed

- Report production imports of the `@effect/platform-node` barrel with module subpaths that avoid loading optional integrations such as redis.
- Recognize native Effect `catchTags` record keys regardless of the handler body while retaining diagnostics for actual nested component and hook factories.
- Keep a constant's matching filename valid when the constant becomes private.
- Name each conflicting fix and format pass's file and line/column range when `quality fix` cannot settle.
- Use Node platform module subpaths in package runtimes and commands instead of loading the barrel.

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
