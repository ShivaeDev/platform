---
"@shivaedev/effect-react": minor
"@shivaedev/effect-contract": minor
---

### Added

- Choose a live changed-hint coalescing window per bound query with React's `useQuery(atom, { coalesceWindow })`, keeping the session window as the default. Queries over one connection refetch on their own schedules; changing the option does not reconnect or refetch queries.
- Configure a bound query's window through its registry with `queryCoalesceWindow(query)` from `@shivaedev/effect-contract/queryCoalesceWindow.ts`.
