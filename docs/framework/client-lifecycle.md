# Client lifetime belongs to the authenticated session

`SessionBoundary` makes a fresh atom registry and client when the signed-in user changes or signs out. Identify by user id by default, so rotating a session after a password change keeps the authenticated React subtree and its state. The registry owns cached query state; React components also own form objects and local state, so replacing only the registry is insufficient as a general reset policy.

`SessionBoundary` owns the registry and React subtree for each session generation.

## Session transition

`SessionBoundary` unmounts the outgoing authenticated subtree, disposes its registry, and mounts a new subtree when the user changes or signs out. A session rotation for the same user keeps the subtree, registry and client. Do not use an access token as a React key or serialization key. Use the user id as the generation key; signing out and logging back into the same account still creates a new generation. When authentication is unresolved or absent, render the public/loading shell without the previous authenticated subtree.

Cached data and dirty forms disappear with the outgoing generation. A failed refresh retains the draft; retry can recover before the auth owner decides to end the session. `SessionBoundary` disposes each outgoing registry. A plain `RegistryContext.Provider` does not own disposal for its caller.

## What a session keeps on the device and for its lifetime

Four things outlive a single screen. Each belongs to the session that wrote it and goes when that session ends:

- **Stored query results.** With a storage Layer as `SessionBoundary`'s `persist`, every bound query result the session's retention keeps is also written to the device under the user that `identify` names. At the next start the boundary reads that user's stored results before the first screen renders, and they seed retention: the screen shows them as stale while the live subscription revalidates them. A sign-out or a signed-out answer of the session check wipes them, and another user's sign-in wipes the previous user's. See [keep query results across a reload](../../packages/react/README.md#keep-query-results-across-a-reload).
- **Warm queries.** `SessionBoundary`'s `warm` names bound queries the session keeps subscribed from the moment the generation commits, so their screens open with the current value. They stay subscribed until the session ends: sign-out, another user or unmount. See [keep queries warm for the session](../../packages/react/README.md#keep-queries-warm-for-the-session).
- **The remembered session.** `authSession(read, { remember })` starts a returning person's app from the last verified session while the real check runs, so the boundary renders and connects at once. It keeps the user id, session id, permissions and expiry, never a credential. A sign-out through `session.signOut`, a signed-out answer, another user and a passed expiry wipe it; give `remember` and `persist` one Layer, as the starter's [auth adapter](../../examples/starter/src/client/adapters/auth.ts) does, so the stored results go with it. See [start from the last verified session](../../packages/identity/README.md#start-from-the-last-verified-session) and [Better Auth actions](../../packages/react/README.md#better-auth-actions).
- **Persisted drafts.** Editor and create input persisted with `persistedDraft` belongs to the boundary too: a committed session replacement drops tracked drafts. See [persisted input](../../packages/react/README.md#how-to-think-about-it).

An offline write queue needs its own account partition, session ownership and logout policy.

## `SessionBoundary` owns the generation

`@shivaedev/react/client/sessionBoundary.ts` exports this transition as one component. The auth owner supplies the current session (or `undefined` while signed out or unresolved), an opaque `identify` key and `recheck`. An application's `connect`, which builds the session's client, and `warm` come from `clientApp` over its [client modules](../../packages/react/README.md#an-applications-client-modules) and spread into the boundary:

```tsx
import { clientApp } from "@shivaedev/react/client/app.ts";
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import { modules } from "#generated/client/modules.ts";

const app = clientApp(modules);

<SessionBoundary
	{...app}
	session={session}
	identify={(current) => current.user.id}
	recheck={recheck}
	persist={deviceStorage}
	signOut={signOut}
	signedOut={<SignIn />}
>
	{(connection) => <Shell connection={connection} />}
</SessionBoundary>;
```

`session`, `recheck`, `deviceStorage`, `signOut`, `SignIn` and `Shell` belong to the application. Each key gets one client and one registry: `connect` runs once per key, so anything it captures stays fixed for that key. A browser client authenticates with the session cookie the browser sends; a bundled native client reads its stored credential through `bearerToken`, an Effect over identity's `SessionCredential` port that runs each time the socket connects, with `sessionCredentialPlugin` keeping that credential current for the auth client, as [bundled native clients](../../packages/identity/README.md#bundled-native-clients) describes. Either way a rotation under the same user id reaches the next connection without a new key. Identifying by session id or including a credential generation (`${session.id}:${generation}`) stays an explicit choice: it remounts the subtree and drops its state on every rotation. A new key remounts the subtree; `undefined` renders `signedOut`. Give the boundary the signed-out router and a `redirectTo` continuation target. Once the auth owner supplies the signed-in session, the boundary unmounts that router before replacing the URL and mounting the authenticated tree. Targets outside the browser origin fall back to `/`. An optional `navigate` callback replaces the URL through the application's router history. The sign-in screen requests a session recheck rather than navigating before the new session is known.

The registry is disposed one microtask after the generation's effects unmount, so StrictMode's effect replay does not dispose a live registry. A subtree hidden by React's `<Activity>` also unmounts its effects while keeping component state; the generation then disposes the registry and renders its kept subtree against a fresh registry for the same client, so revealing it keeps local state and form drafts but reads its queries again. React still re-renders a hidden subtree at low priority, and nothing runs if that subtree is then unmounted without being revealed, so atoms a hidden render reads are reset (finalizers run, `keepAlive` runtimes and RPC connections close) as soon as the render settles. StrictMode's double state initializer can call `connect` twice for the same key; keep it free of side effects.

`useQuery` and `useAction` inside the boundary call `recheck` when a result fails with a tagged `Unauthorized` error. They do not clear retained data: the auth owner decides whether the session ended and, if so, changes `session`, which tears the generation down.

## Resume reopens the live subscriptions

A bound query is live: it shows what the server pushes, and the browser does not refresh it. When the page becomes visible again or the browser comes back online, the session's client reopens its subscriptions, and the server answers each open query with its current result. A native shell adds its own resume events through the client's `resume` option, a function that subscribes a callback and returns its unsubscribe function. `clientApp` passes it to the client it makes:

```ts
import { clientApp } from "@shivaedev/react/client/app.ts";
import { modules } from "#generated/client/modules.ts";
import { onAppResume } from "#client/adapters/nativeLifecycle.ts";

const app = clientApp(modules, { resume: onAppResume });
```

The application implements `onAppResume` in its own adapter, for example over Capacitor's `App` `resume` listener; the package does not depend on Capacitor. A module's bound query, such as the notes module's `notes.list.query()` that its route reads and its `warm` list names, keeps its value while the reopened subscription catches up and then shows the server's result. Disposing the session's registry releases the listeners. The react README's [resume from a native shell](../../packages/react/README.md#resume-from-a-native-shell) shows the same source on `makeClient`, and [resume and refresh policy](../../packages/react/README.md#resume-and-refresh-policy) covers a native atom that is not a bound query.

## Refresh and authentication failures are different decisions

Within an unchanged session, the query hook exposes native `AsyncResult` state: previous successful data remains available alongside a refresh error. The draft stays mounted, so unsaved edits survive. A user-triggered refresh retries the read; a successful retry clears the error without discarding edits.

`Unauthorized` does not erase the last successful query value automatically. Inside a `SessionBoundary` it asks the auth owner to re-check; once that owner decides the session has expired or ended, it changes the boundary's session. A retained value is useful during transient refresh failure; it is not permission to keep an expired authenticated screen visible. The starter's [App](../../examples/starter/src/client/App.tsx) supplies its `authSession`'s refresh as `recheck`.

## Query retention

Bound contract queries use native atoms for execution and retained results:

- Each registry stores its own atom values. Atom identity alone does not imply shared cached values across registries.
- The client caches each bound query atom by operation, payload, headers and serialization key. Make the client once per session, as `SessionBoundary`'s `connect` does, rather than inside each render.
- A bound query reruns on the server when a write announces a key it reads, and the server pushes the new result over the client's socket; the browser keeps no keys and refreshes nothing itself, as the [live-update guide](./live-updates.md) explains. A command's change is on the screen once every open live query shows the server's state after it; see [when a command's change is on the screen](../../packages/contract/README.md#when-a-commands-change-is-on-the-screen).
- Credentials installed by a client transform are not automatically an account partition in a query payload. A credential-bound client plus session registry makes that lifetime explicit; do not mutate a singleton's credentials and assume its cached responses become invalid.
- Bound queries retain a successful result for five minutes after the last reader leaves, up to 100 idle results per registry. The least recently left query is evicted first. Reopening shows retained data as stale while the reopened subscription revalidates it. `SessionBoundary.queryRetention` (or the registry’s `queryRetention` atom from `@shivaedev/contract/queryRetention.ts`) configures `timeToLive` and `capacity`; zero disables retention. Expiry uses the query runtime’s Effect Clock. Loaders use this same policy after completing. With `persist`, the results retention keeps are also the ones stored on the device.
- Session disposal takes precedence over any retention policy.
- `serializationKey` enables native serialization; it does not make hydration safe across users. SSR must use request-specific ownership and an explicit hydration policy before enabling it for authenticated data.

## Limits

Registry disposal is not a database rollback mechanism, and it does not cancel a write the server already accepted. Browser cookies, SSR isolation, a real Capacitor lifecycle, a native shell's secure credential storage behind `SessionCredential` and offline writes need the application's own host and authentication integration.
