---
"@shivaedev/work-fleet": patch
"@shivaedev/work-board": patch
---

### Fixed

- Keep the watcher's last observed work states across daemon restarts so completion during reconnection is reported once.
- Drain in-flight Board answer saves during shutdown before releasing their service scope.
