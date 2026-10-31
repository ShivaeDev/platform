---
"@shivaedev/react": patch
---

### Fixed

- Carry the original `NotFound` query rejection in TanStack Router's not-found `data` so a shared root screen can display its server message and typed fields while route-level not-found screens keep precedence.
