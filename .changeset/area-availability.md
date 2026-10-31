---
"@shivaedev/work-fleet": minor
"@shivaedev/work-board": minor
---

### Added

- Fleet exposes area holders and approved queues using its scheduler's ownership, eligibility and priority rules.
- Board carries optional area availability through its existing Fleet queries for the Work Board plugin's compact area view.

### Breaking

- `daemonDiagnostics` now takes the Board directory to discover idle repository areas. Replace `Layer.unwrap(daemonDiagnostics)` with `Layer.unwrap(daemonDiagnostics(boardDir))` when constructing daemon handlers.
