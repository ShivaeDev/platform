# Client lifetime belongs to the authenticated session

Use a fresh native atom registry and a fresh credential-bound RPC client for each login session. Remount the authenticated React subtree at that boundary. The registry owns cached query state; React components also own form objects and local state, so replacing only the registry is insufficient as a general reset policy.

`SessionBoundary` owns the registry and React subtree for each session generation.

## Session transition

The application shell should unmount the outgoing authenticated subtree, dispose its registry, and mount a new subtree with a new session generation key, registry and client. Do not use an access token as a React key or serialization key. Use an opaque generation counter; logging back into the same account is a new session. When authentication is unresolved or absent, render the public/loading shell without the previous authenticated subtree.

Cached data and dirty forms disappear with the outgoing generation. Re-entering starts from persisted data. A failed refresh retains the draft; retry can recover before the auth owner decides to end the session. `SessionBoundary` disposes each outgoing registry. A plain `RegistryContext.Provider` does not own disposal for its caller.

Do not persist or hydrate authenticated atom values across this boundary. Editor and create input persisted with `persistedDraft` belongs to the boundary too: a committed session replacement drops tracked drafts; see [persisted input](../../packages/react/README.md#how-to-think-about-it) in the react README. An offline write queue needs its own account partition, session ownership and logout policy.

## `SessionBoundary` owns the generation

`@shivaedev/react/client/sessionBoundary.ts` exports this transition as one component. The auth owner supplies the current session (or `undefined` while signed out or unresolved), an opaque `identify` key, a `connect` function that builds the credential-bound client, and `recheck`:

```ts
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";

createElement(SessionBoundary, {
	session,
	identify: (session) => session.id,
	connect: (session) => makeApiClient({ token: () => auth.currentToken() }),
	recheck: () => auth.refetch(),
	signedOut: createElement(SignIn),
	children: (api) => createElement(App, { api }),
})
```

Each key gets one client and one registry: `connect` runs once per key, so anything it captures stays fixed for that key. A client that captures `session.token` keeps the old token after a refresh under the same session id. Either let the client read the current credential per request, as above, or make `identify` include a credential generation (`${session.id}:${generation}`), which remounts the subtree and drops its state on every rotation. A new key remounts the subtree; `undefined` renders `signedOut`.

The registry is disposed one microtask after the generation's effects unmount, so StrictMode's effect replay does not dispose a live registry. A subtree hidden by React's `<Activity>` also unmounts its effects while keeping component state; the generation then disposes the registry and renders its kept subtree against a fresh registry for the same client, so revealing it keeps local state and form drafts but refetches queries. React still re-renders a hidden subtree at low priority, and nothing runs if that subtree is then unmounted without being revealed, so atoms a hidden render reads are reset (finalizers run, `keepAlive` runtimes and RPC connections close) as soon as the render settles. StrictMode's double state initializer can call `connect` twice for the same key; keep it free of side effects.

`useQuery` and `useAction` inside the boundary call `recheck` when a result fails with a tagged `Unauthorized` error. They do not clear retained data: the auth owner decides whether the session ended and, if so, changes `session`, which tears the generation down.

## Resume refreshes through native signals

`resumeSignal({ window, native })` is an atom that increments on a `visibilitychange` to visible, on `online` while visible, and on every call from an injectable native source `(resume) => unsubscribe`. A Capacitor app passes its `App` `resume` listener there; the package does not depend on Capacitor. Create the signal once and feed native combinators:

```ts
const resume = resumeSignal({ window, native: capacitorResume })
const orders = Atom.makeRefreshOnSignal(resume)(api.query("ListOrders", undefined))
const profile = Atom.swr(api.query("Profile", undefined), {
	staleTime: "5 minutes", revalidateOnFocus: true, focusSignal: resume,
})
```

`makeRefreshOnSignal` refetches on every signal; a visibility change and a reconnect arriving together refetch twice. `swr` skips fresh or in-flight results.

## Refresh and authentication failures are different decisions

Within an unchanged session, the query hook exposes native `AsyncResult` state: previous successful data remains available alongside a refresh error. The draft stays mounted, so unsaved edits survive. A user-triggered refresh retries the read; a successful retry clears the error without discarding edits.

`Unauthorized` does not erase the last successful query value automatically. Inside a `SessionBoundary` it asks the auth owner to re-check; once that owner decides the session has expired or ended, it changes the boundary's session. A retained value is useful during transient refresh failure; it is not permission to keep an expired authenticated screen visible. The starter's [App](../../examples/starter/src/client/App.tsx) supplies Better Auth's `session.refetch` as `recheck`.

## Native cache policy

These follow from `effect/reactivity/AtomRpc` and `AtomRegistry`:

- Each registry stores its own atom values. Atom identity alone does not imply shared cached values across registries.
- `Client.query` uses a native atom family. Its query key includes the RPC tag, payload, optional headers, reactivity keys, TTL and serialization key. Define clients once per session rather than rebuilding them inside each render.
- Credentials installed by a client transform are not automatically an account partition in a query payload. A credential-bound client plus session registry makes that lifetime explicit; do not mutate a singleton's credentials and assume its cached responses become invalid.
- Finite `timeToLive` delegates to `Atom.setIdleTTL`; infinite TTL uses `Atom.keepAlive`. This is retention after inactivity, not a promise that data stays fresh for that duration or a polling interval.
- Session disposal takes precedence over any retention policy.
- Reactivity keys connect local successful mutations to query refresh. They do not deliver cross-device changes, implement offline replay or authenticate a request. Explicit refresh remains useful for external changes.
- Native Reactivity expands a record key such as `{ orders: [id] }` into both `"orders"` and `"orders:<id>"`, when registering a query and when invalidating. The `contract` binding registers item queries with `` `orders:${id}` `` and `"orders:*"`, the list with `"orders"`, and invalidates the item key and `"orders"` after a save, so one save refreshes that order and the list but no other mounted order.
- `serializationKey` enables native serialization; it does not make hydration safe across users. SSR must use request-specific ownership and an explicit hydration policy before enabling it for authenticated data.

## Limits

Registry disposal is not a database rollback mechanism, and it does not cancel a write the server already accepted. Browser cookies, SSR isolation, a real Capacitor lifecycle, secure token storage and offline writes need the application's own host and authentication integration.
