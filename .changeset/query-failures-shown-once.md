---
"@shivaedev/react": minor
"@shivaedev/admin": patch
---

### Added

- `@shivaedev/react`: a route's loaded query (`queryRoute(...).useQuery()`, `useLoaderQuery`) and an editor given the route's loaded row publish a failed refresh to the mounted `NoticeHost` without screen code. The last data and the draft stay; a shared request rejection shows the server's `message`, and a server outage, an `InternalServerError`, a defect or an untagged failure shows the host's `failure` wording. The notice carries a Retry action that refreshes the query, a query shows one such notice at a time, and the notice goes when the query next succeeds. A lost connection and a refused read publish nothing.
- `@shivaedev/react`: a route under `SessionApp` or `sessionRouter` whose loader fails shows a default failure screen without declaring `errorComponent`, worded as a notice would be, with a Retry that reruns the route's own query. Pass `loadFailure` in the routing options to replace that screen once for every route; it receives `FailureLayout` (`{ message, retry, retrying }`) from `client/QueryView.ts`. A refusal still shows `forbidden`, `NotFound` still shows the not-found screen, and an error thrown while a route renders still reaches the application.
- `@shivaedev/react`: `QueryView`'s default failure words a server failure with the mounted `NoticeHost`'s `failure` wording, so an application states that wording once.

### Breaking

- `@shivaedev/react`: a route's `useQuery()` and `useLoaderQuery` take `{ keepPreviousData, failures }` in place of `useQuery`'s options. Remove a `notice` callback that worded shared rejections or outages, since the default now shows them; move the wording of a rejection the app declared into `failures: { Tag: handler }`, where a handler receives the error and returns a notice descriptor or `"silent"`, or use `"message"`. Such a rejection now needs a handler: the call does not compile without one.
- `@shivaedev/react`: `useEditor` drops `queryNotice`. An editor given `loaded` publishes its query's failed refreshes by default and takes `queryFailures` for a rejection the app declared, which it requires; an editor without `loaded` shows its query's failures through `QueryView`.
- `@shivaedev/react`: `QueryViewDefaults`' and `QueryViewRenderers`' `failure` receives `{ message, retry, retrying }` in place of `(error, query)`, so it lays out words the server or the notice host already chose. Move framework-failure wording into `NoticeHost`'s `failure` and keep only the layout. `queryFailureMessage` is removed; the default failure reads the host's wording instead. A view's own `failure(error, query)` is unchanged.
- `@shivaedev/react`: `FailureHostContext` holds `{ report, word }` in place of the report function.
- `@shivaedev/react`: `sessionRouter`'s `defaultErrorComponent` is the route failure screen in place of `PermissionBoundaryError`.

### Changed

- `@shivaedev/admin`: the Jobs, Sessions and Users views show a failed load through `QueryView`, so the application's notice host words outages and the server's message words shared rejections, with a Retry, in place of each view's own "Could not load" sentence. A jobs panel no longer hides its content or words a `Forbidden` refusal itself; the Jobs and Sessions pages still show their permission screens.
