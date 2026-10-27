---
"@shivaedev/work-board": minor
---

### Added

- Read Fleet items and goal progress from one snapshot with the `overview` query.

### Fixed

- Keep started Fleet work in goal running counts, including work waiting for an answer, CI or merge, to match In flight.
- Include working and reviewing tasks when a Fleet daemon omits execution details.
