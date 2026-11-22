---
"@shivaedev/react": minor
---

### Breaking

- A route's `useLoaded()` returns the handlers the route's `queryRoute(buildQuery, { failures })` declares as `queryFailures`, beside `loaded` and `query`, so an editor that spreads it words its refresh notices as the route does. Delete the editor's `queryFailures` that repeats the route's `failures`: `useEditor(api.save, { ...route.useLoaded(), queryFailures })` becomes `useEditor(api.save, { ...route.useLoaded() })`. A component that takes the loaded row as a prop types it as `LoadedRoute<A, E>` from `@shivaedev/react/client/adapters/queryRoute.ts`, which carries the handlers.
