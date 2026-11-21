---
"@shivaedev/react": patch
---

### Changed

- A route's loaded query that fails to refresh with a rejection the app declared shows its handler's notice without the default Retry, as the route's failure screen does when the first load fails with it, since reading again brings the same answer. A handler that returns its own `action` keeps it on the notice, and every other failure keeps its Retry.
