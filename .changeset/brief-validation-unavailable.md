---
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- `@shivaedev/work-board`: Show an unavailable diagnostic on a brief and mark Fleet items unavailable when their brief checks fail; successful checks still accept or refuse briefs.
- `@shivaedev/work-fleet`: Report failed brief validation as unavailable through diagnostics instead of treating it as acceptance.
