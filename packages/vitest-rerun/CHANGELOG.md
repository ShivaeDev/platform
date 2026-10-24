# Changelog

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
