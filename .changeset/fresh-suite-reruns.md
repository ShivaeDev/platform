---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- Rerun failed suite hooks in a fresh process, and record recovered suite hooks and file-load failures in `flaky-tests.json` with their file, JUnit classname, failure messages and attempt count.
