---
"@shivaedev/work-fleet": patch
---

### Fixed

- Check daemon liveness independently of the watch stream so stalled provider work or stream delivery does not report a responsive daemon as unreachable.
