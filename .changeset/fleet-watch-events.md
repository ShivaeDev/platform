---
"@shivaedev/work-fleet": minor
---

### Added

- Stream JSON Fleet transitions with `work-fleet watch --board <dir>`, event filtering, configurable stuck detection, PR and head details, dispatch and answer failures, and daemon health across restarts.

### Breaking

- `watch` without work IDs now continuously streams JSON instead of waiting for the initial active set to finish. Use `watch <ids...>` for finite text outcomes or `watch --follow` for continuous text outcomes.
