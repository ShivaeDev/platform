---
"@shivaedev/build": patch
---

### Fixed

- Two `generate` runs that overlap on one project over the same sources both succeed and leave what one run writes, such as two `prepare` scripts that generate at once during an install. Before, one of them, whether a `generate`, a test run's global setup or a type check, could die with `NotFound` for a path under `src/generated`, from `FileSystem.readDirectory` when it met the other run's temporary folder after that run removed it, or from `FileSystem.stat` or `FileSystem.remove` when the other run had already removed a leftover generated file, and it passed on a rerun. Any other failure to list, read or remove a file under `src/generated` still stops `generate`.
