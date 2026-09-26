# Client lifetime belongs to the authenticated session

Use a fresh native atom registry and a fresh credential-bound RPC client for each
login session. Remount the authenticated React subtree at that boundary. The
registry owns cached query state; React components also own form objects and
local state, so replacing only the registry is insufficient as a general reset
policy.

This is application composition, not another cache or session framework.
The [executable example](../../packages/effect-react/test/session-lifecycle.test.tsx)
uses `makeMealEditor` against the meal feature's real loopback HTTP endpoint.

## Session transition

The application shell should unmount the outgoing authenticated subtree, dispose
its registry, and mount a new subtree with a new session generation key, registry
and client. Do not use an access token as a React key or serialization key. Use an
opaque generation counter; logging back into the same account is a new session.
When authentication is unresolved or absent, render the public/loading shell
without the previous authenticated subtree.

The test switches the same React root from Alice to Bob, first requesting Alice's
meal under Bob's credentials, then Bob's own meal. Alice's cached meal and dirty
form disappear; the cross-owner request fails; Bob sees his own meal. Returning
to Alice starts from persisted data rather than resurrecting her old draft.
Unmount and explicit disposal leave the registry empty and reject further reads.
A plain `RegistryContext.Provider` does not own this disposal for its caller.

Do not persist or hydrate authenticated atom values across this boundary. Any
future persisted draft or offline queue requires an explicit account partition,
session ownership and logout policy; it is not covered by this example.

## `SessionBoundary` owns the generation

`@shivaedev/effect-react` exports this transition as one component. The auth
owner supplies the current session (or `undefined` while signed out or
unresolved), an opaque `identify` key, a `connect` function that builds the
credential-bound client, and `recheck`:

```ts
createElement(SessionBoundary, {
	session,
	identify: (session) => session.id,
	connect: (session) => makeApiClient({ token: () => auth.currentToken() }),
	recheck: () => auth.refetch(),
	signedOut: createElement(SignIn),
	children: (api) => createElement(App, { api }),
})
```

Each key gets one client and one registry: `connect` runs once per key, so
anything it captures stays fixed for that key. A client that captures
`session.token` keeps the old token after a refresh under the same session id.
Either let the client read the current credential per request, as above, or
make `identify` include a credential generation (`${session.id}:${generation}`),
which remounts the subtree and drops its state on every rotation. A new key
remounts the subtree; `undefined` renders `signedOut`.

The registry is disposed one microtask after the generation's effects unmount,
so StrictMode's effect replay does not dispose a live registry. A subtree hidden
by React's `<Activity>` also unmounts its effects while keeping component state;
the generation then disposes the registry and renders its kept subtree against a
fresh registry for the same client, so revealing it keeps local state and form
drafts but refetches queries. React still re-renders a hidden subtree at low
priority, and nothing runs if that subtree is then unmounted without being
revealed, so atoms a hidden render reads are reset (finalizers run, `keepAlive`
runtimes and RPC connections close) as soon as the render settles. StrictMode's double state initializer can call
`connect` twice for the same key; keep it free of side effects.

`useQuery` and `useAction` inside the boundary call `recheck` when a result
fails with a tagged `Unauthorized` error. They do not clear retained data: the
auth owner decides whether the session ended and, if so, changes `session`,
which tears the generation down. The
[boundary tests](../../packages/effect-react/test/session-boundary.test.tsx) cover
switching accounts, signing out, re-entering the same account under a new key,
Unauthorized re-checks, StrictMode, `<Activity>` hide and reveal and credential
rotation under a fixed or generation-bearing key.

## Resume refreshes through native signals

`resumeSignal({ window, native })` is an atom that increments on a
`visibilitychange` to visible, on `online` while visible, and on every call from
an injectable native source `(resume) => unsubscribe`. A Capacitor app passes
its `App` `resume` listener there; the package does not depend on Capacitor.
Create the signal once and feed native combinators:

```ts
const resume = resumeSignal({ window, native: capacitorResume })
const meals = Atom.makeRefreshOnSignal(resume)(api.query("ListMeals", undefined))
const profile = Atom.swr(api.query("Profile", undefined), {
	staleTime: "5 minutes", revalidateOnFocus: true, focusSignal: resume,
})
```

`makeRefreshOnSignal` refetches on every signal; a visibility change and a
reconnect arriving together refetch twice. `swr` skips fresh or in-flight
results. [Synthetic-signal tests](../../packages/effect-react/test/resume-signal.test.ts)
cover hidden/visible events, native resume, staleness and listener removal. They do
not validate a real Capacitor lifecycle or suspended network requests.

## Refresh and authentication failures are different decisions

Within an unchanged session, the query hook exposes native `AsyncResult` state:
previous successful data remains available alongside a refresh error. The draft
stays mounted, so unsaved edits survive. A user-triggered refresh retries the read;
a successful retry clears the error without discarding edits. The test proves
this by temporarily revoking and then restoring the example credential.

That test also exposes an important boundary: `Unauthorized` does not erase the
last successful query value automatically. Inside a `SessionBoundary` it asks the
auth owner to re-check; once that owner decides the session has expired or ended,
it changes the boundary's session. A retained value is useful during transient
refresh failure; it is not permission to keep an expired authenticated screen
visible. Wiring `recheck` to Better Auth or another real auth owner remains
application integration work.

## Native cache policy

These details were checked against the installed Effect `4.0.0-rc.112` source:
`effect/unstable/reactivity/AtomRpc` and `AtomRegistry`.

- Each registry stores its own atom values. Atom identity alone does not imply
  shared cached values across registries.
- `Client.query` uses a native atom family. Its query key includes the RPC tag,
  payload, optional headers, reactivity keys, TTL and serialization key. Define
  clients once per session rather than rebuilding them inside each render.
- Credentials installed by a client transform are not automatically an account
  partition in a query payload. A credential-bound client plus session registry
  makes that lifetime explicit; do not mutate a singleton's credentials and
  assume its cached responses become invalid.
- Finite `timeToLive` delegates to `Atom.setIdleTTL`; infinite TTL uses
  `Atom.keepAlive`. This is retention after inactivity, not a promise that data
  stays fresh for that duration or a polling interval.
- The current meal query supplies no TTL override. Set retention intentionally
  when a real navigation use case needs it. Session disposal takes precedence
  over any retention policy.
- Reactivity keys connect local successful mutations to query refresh. They do
  not deliver cross-device changes, implement offline replay or authenticate a
  request. Explicit refresh remains useful for external changes.
- Native Reactivity expands a record key such as `{ meals: [id] }` into both
  `"meals"` and `"meals:<id>"`, when registering a query and when invalidating.
  The meal example declares these keys once in its contract; the
  `effect-contract` binding registers item queries with `` `meals:${id}` ``, the
  list with `"meals"`, and invalidates both after a save, so one save refreshes
  that meal and the list but no other mounted meal.
- `serializationKey` enables native serialization; it does not make hydration
  safe across users. SSR must use request-specific ownership and an explicit
  hydration policy before enabling it for authenticated data.

## Evidence and remaining work

Run:

```sh
pnpm --filter @shivaedev/effect-react exec vitest run test/session-lifecycle.test.tsx test/session-boundary.test.tsx
```

These tests use happy-dom and actual HTTP serialization, authentication and
SQL-backed feature handlers. They establish rendered session replacement,
refresh/retry behavior and explicit registry teardown. They do not establish
browser cookie behavior, SSR isolation, real Capacitor lifecycle, secure token storage, offline writes or server-side cancellation of an
already accepted write. Registry disposal is not a database rollback mechanism.
Those policies need the real application's host and authentication integration.

## Bun

Bun 1.3.14 was checked by hand against the same native components: `Bun.serve`
hosting `HttpRouter.toWebHandler(RpcServer.layerHttp(...))` with the meal
contract and authentication middleware, a `FetchHttpClient` RPC client and an
`AtomRpc` query through an atom registry. Reads, typed rejections, Unauthorized
and saves round-tripped. Interrupting the client fiber aborted the request and
the server handler's scope closed with interruption, so `Bun.serve` forwards the
disconnect to `request.signal`. Vitest's DOM hook and resume tests also pass when
run with `bun --bun`.

The SQLite-backed meal backend does not run under Bun: `@effect/sql-sqlite-node`
imports `node:sqlite`, which Bun 1.3.14 lacks. A Bun host needs a Bun SQL driver.
This check is not part of CI.
