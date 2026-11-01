---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- Rerun a file in full when its `beforeAll` or `afterAll` fails, including nested suite hooks. Keep unresolved hook diagnostics and new failures in the merged results.
