---
"@shivaedev/vitest-rerun": minor
---

### Breaking

- `--reporter` arguments are ignored, and only `vitest-rerun`'s own reports are written. A caller that passed `--reporter=json --outputFile=<file>` or `--reporter=junit` to get a report reads `tests.json` or `tests.junit.xml` in the output directory instead, and sets that directory with `--output-dir`. These reports describe the whole run; a reporter named on the command line described only the last attempt.

### Fixed

- A run under `quality ci --coverage` keeps `vitest-rerun`'s own reports and merges coverage. Before, the reporters that command adds replaced them, so the coverage merge failed to read `tests.json` and the run exited 1 with every test passing.
