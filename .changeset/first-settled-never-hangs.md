---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/contract`: `clientActivity(client).rendered` is an Effect that tells the client its first screen has been drawn. The activity's `firstSettled` flag turns `true` once it has run and nothing on the client is waiting.
- `@shivaedev/react`: `RouterProvider` from `@shivaedev/react/adapters/RouterProvider.ts` takes TanStack's `RouterProvider` props and renders it, and holds `useFirstSettled` until the first route has rendered, so the hook reveals a routed first screen in one step wherever it is called. Swap the import of TanStack's `RouterProvider` for this one; nothing else changes.

### Changed

- `@shivaedev/react`: `useFirstSettled(client)` turns `true` once the screen that calls it has rendered and nothing on the client is waiting, so a first screen that reads no query, such as a blank form or a welcome page, is revealed instead of waiting forever. A screen that reads queries is still revealed in one step after they answer, and a query that shows a stored or retained result does not hold the reveal back while it revalidates. A `useFirstSettled` above TanStack's own `RouterProvider` turns `true` at the first render, before the first route exists; the fix is the import swap above.

### Breaking

- `@shivaedev/contract`: the client activity's `firstSettled` flag no longer turns on from a first query answer alone. A reader of the activity stream outside React runs `clientActivity(client).rendered` once its first screen is drawn; `useFirstSettled` does this for React.
