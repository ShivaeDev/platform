---
"@shivaedev/react": minor
---

### Added

- A route's `useLoaded()` returns the handlers its `queryRoute(buildQuery, { failures })` declares as `queryFailures`, beside `loaded` and `query`; `LoadedRoute<A, E>` from `@shivaedev/react/client/adapters/queryRoute.ts` names that shape. An editor that spreads it words its failed refreshes with the route's handlers, so an editor that passed no `queryFailures` now also uses the optional handlers the route declares, such as one for a shared rejection. A screen can delete an editor's `queryFailures` that repeats the route's `failures`; one given after the spread still wins.
