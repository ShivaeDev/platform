---
"@shivaedev/effect-contract": minor
"@shivaedev/effect-react": minor
---

### Added

- Coalesce live changed hints over a default 20 ms window, with one follow-up read when hints arrive during an in-flight refetch. Configure `live()` with `coalesceWindow`, or set its returned `coalesceWindow` atom; zero retains immediate invalidation. Reconciliation stays immediate.
- Configure automatic live connections per React `SessionBoundary` with `liveCoalesceWindow`.
