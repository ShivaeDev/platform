# @shivaedev/vitest-rerun

A flaky test in CI either blocks a merge for a reason unrelated to the change or, with Vitest's in-process `retry`, passes in the same polluted worker that made it fail. This package reruns failed Vitest tests in a fresh process under its own retry policy and records every test that needed a rerun in `flaky-tests.json`, so a repository can merge through flakiness without losing sight of it.

`flaky-tests.json` and the JUnit `classname` are contracts that consumers build against. Keep the file name, its fields and their meaning stable; a change to them is a breaking change. Quarantining or ranking flaky tests belongs to whatever reads `flaky-tests.json`, and choosing which CI events may rerun belongs to the repository; the package never retries unhandled errors, crashed workers or setup outside a test file, and never runs a test runner other than Vitest. Read [the README](./README.md) for usage.

When goals conflict, lean in this order:

1. **Report the truth.** A test that failed stays visible: in the final result when it never passed, in `flaky-tests.json` when it passed on a rerun. Never let a rerun hide a failure or invent one.
2. **Rerun cleanly.** Every attempt is a new process. Rerun only what failed, and never rerun what a test rerun cannot fix, such as an unhandled error.
3. **Keep reports whole.** The final JSON, JUnit and coverage reports describe the entire run, as if it had run once, so their consumers need no knowledge of attempts.
4. **Stay a thin layer over Vitest.** Use Vitest's own reporters, state and coverage provider. Own the retry policy, not test running.
