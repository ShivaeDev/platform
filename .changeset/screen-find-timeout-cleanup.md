---
"@shivaedev/test-story": patch
---

### Fixed

- A timed-out DOM screen lookup closes its interrupted React `act()` scope before the story finishes, so later stories in the same file render and respond normally.
