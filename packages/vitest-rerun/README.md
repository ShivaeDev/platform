# @shivaedev/vitest-rerun

A flaky test should get a clean second chance, and you should learn that it needed one. This package runs Vitest, reruns only the failed tests in a fresh process, and writes the tests that passed only on a rerun to `flaky-tests.json` beside the usual JUnit report.

## Why you want this

Vitest's built-in `retry` repeats a failed test in the same worker, with the same module state, mocks and open handles that may have caused the failure. A retry there can fail for the wrong reason, or pass while hiding that the first attempt broke something. A rerun in a new process starts from nothing, like the first attempt did.

```sh
vitest-rerun -- --coverage
```

When a test fails once and then passes, the run succeeds and `test-results/flaky-tests.json` names it:

```json
[
  {
    "classname": "src/checkout.test.ts",
    "name": "checkout > charges the card once",
    "file": "src/checkout.test.ts",
    "attempts": 2,
    "messages": ["expected 2 to be 1"]
  }
]
```

The final JUnit and JSON reports still describe the whole run, so CI, coverage and test dashboards see one result per test.

## Using it

### How a run works

`vitest-rerun` runs `vitest run` once in a child process with Vitest's own retries turned off. If tests failed, it starts a new process that runs only the failed tests: tests that passed are skipped by their Vitest test IDs, including passing tests in a failed file. A failed suite hook reruns the tests in its suite, including those that already passed, so the hook has a fresh outcome. A file-level hook failure or a file that failed to load runs the file again in full. Each rerun is one more attempt, and only tests still failing take part in the next one. The run ends when every test passes or the reruns are used up, and its exit code is the last attempt's: `0` when everything passed, `1` when a test is still failing, and `2` for invalid options.

An unhandled error, such as an exception thrown after a test finished, cannot be fixed by running a test again, so a run with one is not rerun and fails.

### Options

```sh
vitest-rerun [--reruns <count>] [--output-dir <directory>] [--] [vitest run arguments]
```

`--reruns` sets how many fresh-process reruns may follow the first attempt; it defaults to `1`, and `0` turns reruns off. `--output-dir` sets where the reports go; it defaults to `test-results`. Every other argument, and everything after `--`, goes to `vitest run`, for example `--config`, `--project`, `--shard` or `--coverage`. `vitest-rerun` supplies Vitest's reporters itself: the default terminal reporter, a JSON report and a JUnit report.

### Reports

A run first deletes the reports of an earlier run in its output directory, then writes:

| File | Contents |
| --- | --- |
| `tests.json` | Vitest's JSON report for the whole run, with each test's final result and a `durationMs` per file that adds up every attempt. |
| `tests.junit.xml` | The JUnit report for the whole run, written with `addFileAttribute`. |
| `flaky-tests.json` | Written when a test, suite hook or file load failed and then recovered on a rerun. |
| `tests.attempt-<n>.json`, `tests.attempt-<n>.junit.xml` | The raw reports of each attempt, kept once a rerun happens. |

Coverage, when enabled, merges every attempt into the configured reports directory, so tests that passed the first time keep their coverage and rerun coverage adds to it. Reruns use their own Vite cache in `<output-dir>/vite-rerun`, so the first attempt's results cache, which Vitest uses to order test files, stays intact. Each recovered test, suite hook or file load also prints a `- Flaky:` line, which is appended to the GitHub Actions job summary when `GITHUB_STEP_SUMMARY` is set; a file that failed to load and then passed is reported there as a collection failure.

### flaky-tests.json

The file holds one entry per test, suite hook or file load that recovered on a rerun:

| Field | Value |
| --- | --- |
| `classname` | The file's JUnit `classname`, exactly as in `tests.junit.xml`. |
| `name` | For a test, its JUnit `name`: describe blocks and title joined by ` > `. For a suite hook, the suite path followed by ` (suite hook)`, or the file path for a file-level hook. For a file load, `file failed to load`. |
| `file` | The test file's path relative to the Vitest root, the same as the JUnit `file` attribute. |
| `attempts` | How many attempts the failure took to recover, counting the one that passed. |
| `messages` | The error message of each failed attempt, in order. |

The JUnit `classname` is the file's path relative to the Vitest root. When the test runs in a named Vitest project, the project comes first, as in `|unit| src/checkout.test.ts`, so a file that runs in two projects has a distinct `classname` in each. Suite-hook and file-load entries use the same fields as tests, with the file's JUnit classname and a name that identifies the failure.

Read the file with the `FlakyTests` schema from `@shivaedev/vitest-rerun/flakyTests.ts`:

```ts
import { Schema } from "effect";
import { FlakyTests } from "@shivaedev/vitest-rerun/flakyTests.ts";

const flaky = Schema.decodeUnknownSync(Schema.fromJsonString(FlakyTests))(contents);
```

### From Effect

The command line is a thin wrapper over two Effect functions. `parseOptions(args, cwd)` from `@shivaedev/vitest-rerun/options.ts` turns command-line arguments into `RerunOptions`, with the output directory resolved against `cwd`, the directory every attempt runs in, failing with a `VitestRerunError` from `/error.ts` for an invalid rerun count. `rerun(options)` from `/rerun.ts` performs the run and succeeds with its exit code; it needs `FileSystem` and `ChildProcessSpawner`, which `NodeServices.layer` from `@effect/platform-node` provides.

### Install and limits

```sh
npm install --save-dev @shivaedev/vitest-rerun vitest@5.0.3 effect@4.0.5 @effect/platform-node@4.0.5 @effect/platform-node-shared@4.0.5
```

`vitest`, `effect` and the Effect Node platform packages are peers, so your own versions run the tests. The package needs Node 24 or later.

- Vitest's `retry` is always `0`; the fresh-process rerun replaces it.
- The package is built for ShivaeDev repositories and may change without a deprecation period.
