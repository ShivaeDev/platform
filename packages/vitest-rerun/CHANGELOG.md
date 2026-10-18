# Changelog

## 0.1.0 - 2026-10-18

### Added

- Add the `vitest-rerun` command, which runs Vitest with retries off and reruns only the failed tests in a fresh process, up to `--reruns` times (default 1), while the final JSON, JUnit and coverage reports describe the whole run.
- Write `flaky-tests.json` whenever a test fails and then passes, with each test's JUnit `classname` and `name`, its file, its attempt count and the messages of its failed attempts; read it with the `FlakyTests` schema from `flakyTests.ts`.
- Name the Vitest project in the JUnit `classname`, so a file that runs in two projects keeps a distinct identity in each.
