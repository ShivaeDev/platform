# Roadmap

This file owns vitest-rerun's implementation status and open questions. A story in this package establishes the runner's behavior against real Vitest processes, not every consumer's CI.

## Built

- [x] A `vitest-rerun` command that runs Vitest with retries off and reruns only the failed tests in fresh processes, up to `--reruns` times (default 1).
- [x] Final JSON and JUnit reports for the whole run, with summed durations and the raw report of each attempt.
- [x] Coverage merged from every attempt, and a separate Vite cache for reruns.
- [x] `flaky-tests.json` with each recovered test's JUnit `classname` and `name`, file, attempt count and failure messages, plus the `FlakyTests` schema to read it.
- [x] A JUnit `classname` that names the Vitest project, so a file that runs in two projects stays distinct.
- [x] No rerun after an unhandled error; a recovered collection failure is reported in the job summary.
- [x] Platform's CI shards run through the package, with reruns only in the merge queue.

## Open questions

- Whether a file that failed to load and then passed belongs in `flaky-tests.json`. It has no testcase in the final JUnit report, so today it appears only in the job summary.
- Whether a rerun should also cover failures in `beforeAll` and `afterAll` hooks that Vitest reports on a suite rather than a test.
