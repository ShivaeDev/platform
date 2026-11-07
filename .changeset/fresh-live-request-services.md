---
"@shivaedev/server": patch
---

### Fixed

- Rebuild live query request services with the freshly reloaded session user, so role changes reach read policies and query handlers on rerun.
