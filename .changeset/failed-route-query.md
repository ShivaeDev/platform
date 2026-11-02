---
"@shivaedev/react": patch
---

### Fixed

- Keep a failed route's query in its registry until its own retry refreshes it or the route leaves, so refreshing another query cannot recover the failed route.
