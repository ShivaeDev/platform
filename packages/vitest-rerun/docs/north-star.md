# North star

## The problem

Some tests fail now and then for reasons that have nothing to do with the change under test: timing, ports, a slow runner. In a merge queue, each such failure blocks a merge and costs a full rerun of CI. Vitest's `retry` option looks like the fix, but it repeats the test in the same worker. Module state, mocks, timers and handles left behind by the failed attempt are still there, so the retry is not a clean second chance, and a pass after it says little.

Rerunning by hand or rerunning the whole job hides the flake entirely. Nobody records which tests needed a second attempt, so flaky tests accumulate until the suite is unreliable.

## The ideal

A repository replaces `vitest run` in CI with `vitest-rerun`. Failed tests get a clean rerun in a fresh process, only the failed tests run again, and the job's result reflects whether each test eventually passed. Every recovered test is written to `flaky-tests.json` with its JUnit identity, its attempt count and the messages of its failed attempts, so a dashboard, a bot or a person can find it, count it and fix it.

The final reports read as if the run happened once: one JUnit testcase per test with its final result, a JSON report with summed durations, and coverage merged from every attempt. Tools that read JUnit or LCOV need no knowledge of reruns.

## What good looks like

- A test that fails once and then passes yields a passing run and one `flaky-tests.json` entry whose `classname` and `name` match its JUnit testcase.
- A test that keeps failing fails the run and produces no flaky entry.
- A clean run writes no flaky file and runs every test once.
- A file that runs in several Vitest projects keeps a distinct JUnit identity per project.
- Tests that passed, including passing tests beside a failed one, never run twice.

## Trade-offs

**Truth before green.** The package exists to let flaky tests pass, so it must be strict about everything else: an unhandled error, a test still failing after the last rerun or a broken report fails the run.

**Clean attempts before speed.** A fresh process costs startup time on every rerun. That cost is the point; an in-process shortcut would bring back the problem this package solves.

**A stable contract before a richer one.** `flaky-tests.json` stays small and its fields keep their names. New information goes into new fields only when a real consumer needs it.

**Vitest's machinery before our own.** Reports come from Vitest's JSON and JUnit reporters and coverage from its coverage provider. The package selects tests, merges attempt results and writes one file of its own.

## What it leaves out

- Quarantining, skipping or ranking flaky tests across runs; that belongs to whatever reads `flaky-tests.json`.
- Retrying unhandled errors, crashed workers or failed setup outside a test file.
- Test runners other than Vitest, and in-process retries.
- Deciding which CI events may rerun; a repository chooses `--reruns` per event.
