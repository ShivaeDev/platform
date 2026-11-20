---
"@shivaedev/react": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/react`: the result of `queryRoute(buildQuery)` has `useQuery(options?)`, which reads the route's query with the current match's params, decoded search, context and loader value, so a route's component no longer names the operation and its arguments again. `useLoaded()` returns the same atom as `query` and the loader value as `loaded`, to spread into a loader-backed `useEditor`. Replace `useLoaderQuery(api.get.query({ id }), route.useLoaderData())` in a route's component with `noteQuery.useQuery()`, keeping the `queryRoute` result as `noteQuery`; `useLoaderQuery` stays for loaders written with `loadQuery`.
- `@shivaedev/react`: a query route reads `redirects` from the router context, so `redirects.signedOut` and `redirects.refused` are stated once for every query route. A route's own `queryRoute(buildQuery, { redirects })` still overrides them for its query.
- `@shivaedev/react`: `signInRedirect(path)` in `adapters/signInRedirect.ts` builds a signed-out redirect to `path` that carries the requested location in `returnTo`.

### Breaking

- `@shivaedev/react`: `queryRoute` moves to `client/adapters/queryRoute.ts`, beside the client hooks its `useQuery()` uses. Change `@shivaedev/react/adapters/queryRoute.ts` imports to `@shivaedev/react/client/adapters/queryRoute.ts`.
- `@shivaedev/react`: `permissionGuard` takes `signedOut`, the redirect callback, in place of the `signIn` path. Before: `permissionGuard({ session, signIn: "/sign-in" })`. After: put `redirects: { signedOut: signInRedirect("/sign-in") }` in the router context and pass it to the guard: `beforeLoad: ({ context, ...route }) => permissionGuard({ session, signedOut: context.redirects.signedOut })(route)`.

### Changed

- `@shivaedev/create-app`: generated apps state their sign-in redirect once in the router context, read each route's query through `useQuery()` or `useLoaded()`, and their note route failure screen no longer handles signed-out visitors, whom the loader now redirects to sign-in.
