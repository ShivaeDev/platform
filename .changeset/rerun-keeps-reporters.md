---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- A run whose command line names reporters, such as one under `quality ci --coverage`, keeps `vitest-rerun`'s own reports and merges coverage instead of failing to read `tests.json` with every test passing; `--reporter` arguments are ignored.
