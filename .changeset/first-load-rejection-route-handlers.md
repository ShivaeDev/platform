---
"@shivaedev/react": minor
---

### Fixed

- A route whose first load fails with a rejection the app declared shows what the route's own `failures` handlers return for its refresh notice, the server's message for `"message"`, instead of the notice host's unexpected-failure wording. The failure screen offers no Retry for such a rejection, since reading again brings the same answer; every other failure keeps its wording and its Retry.

### Breaking

- `queryRoute(buildQuery, { failures })` now takes the handlers for the rejections the app declared, and the declaration does not compile without them; a route's `useQuery()` takes only `keepPreviousData`. Move the `failures` passed to the route's `useQuery({ failures })` into the route's `queryRoute(...)` options, beside `redirects`. A route whose query can fail with a declared rejection now needs them even when its screen only calls `useLoaded()`.
- `FailureLayout`'s `retry` is optional: the router's failure screen leaves it out where reading again cannot help. An application's `loadFailure` screen or `QueryViewDefaults` failure renderer renders its Retry button only when `retry` is given.
