---
"@shivaedev/server": patch
---

### Fixed

- Answer HTTP RPC requests whose last NDJSON frame has no trailing newline, including the final call in a batch. Malformed frames still return an RPC defect.
