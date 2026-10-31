---
"@shivaedev/work-board": patch
---

### Fixed

- Keep live updates working when the root's watch sentinel cannot be written because of EACCES, EPERM or EROFS. Trust the watcher without confirmation and warn once for that root; other failures still retry.
