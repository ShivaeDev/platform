---
"@shivaedev/contract": minor
"@shivaedev/react": patch
---

### Added

- `@shivaedev/contract`: `queryRuntime(query)` from `@shivaedev/contract/retainQuery.ts` returns the atom runtime a bound query runs on.

### Fixed

- `@shivaedev/react`: A route whose component mounts after its loader read a query now continues the loader's subscription and first result, so the query handler runs once per page view, for live and `live: false` queries alike. `loadQuery` keeps a successful query mounted for a five-second hand-over window on the query runtime's `Clock`; a route that is left or never mounts releases it when the window passes.
