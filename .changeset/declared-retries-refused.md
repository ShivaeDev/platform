---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- Refuse per-test and per-suite Vitest retries after each attempt, naming every affected file and test. Use `--reruns` for global fresh-process retries whose recoveries are recorded in `flaky-tests.json`.
