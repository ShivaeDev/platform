---
"@shivaedev/vitest-rerun": minor
---

### Breaking

- `--exclude` given to `vitest-rerun` now adds to the config's `exclude`, as under `vitest run`. Before, it replaced the config's list, so a test file the config excludes ran whenever the command passed `--exclude`. A run that relied on that replacement now runs fewer tests: put the full list in the config's `exclude`, or name the files to run as filters.
- `--clearCache`, `--listTags` and `--mergeReports` now exit with code 2 before any test runs and say to run `vitest` directly for them. Before, `vitest-rerun` ignored the mode and ran the tests. A script that used one of them runs it with `vitest` itself.
- `--typecheck.only` now turns type checking on and runs only the type tests, as under `vitest run`. Before, it ran the ordinary tests and checked no types, so a CI job that passed it now stops running its ordinary tests without a code change. A job that needs the ordinary tests drops the flag, and a job that needs both passes `--typecheck` instead.

### Fixed

- A file filter with a line, such as `checkout.test.ts:12`, runs only the test on that line, as under `vitest run`. Before, the run failed with `IncludeTaskLocationDisabledError` unless the command also passed `--includeTaskLocation`.
- `--standalone` with a file filter runs that file, as under `vitest run`. Before, the run failed with Vitest's "standalone mode requires --watch".
