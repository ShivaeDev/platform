---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- Decode snapshots and timed JSON reports before using them, reporting malformed files as typed errors that name the file. Read and write timed reports through Effect FileSystem.
