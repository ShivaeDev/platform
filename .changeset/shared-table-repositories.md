---
"@shivaedev/sql": minor
---

### Added

- `defineRepository` exposes a repository and its domain operations through one native Effect service and Layer, shared by services that declare it in `requires`. Initialization retains its typed errors, dependencies and Layer-owned scope; repository operations retain caller transactions.
