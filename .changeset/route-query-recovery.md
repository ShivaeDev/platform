---
"@shivaedev/react": minor
---

### Added

- Return a `useRetry` hook from `queryRoute` so a route's error component can refresh its query and render a successful result without rebuilding the query or replacing the surrounding shell.
- Accept optional `redirects.signedOut` and `redirects.refused` callbacks for native typed TanStack redirects. Signed-out redirects can preserve the full return location with `signInSearch`; refused reads handle both `Forbidden` and `QueryReadDenied`.

### Breaking

- Direct calls to the loader returned by `queryRoute` now require `location` alongside `abortController`, context, deps and params. Pass the native TanStack loader context, or add the requested location to a custom loader invocation.
