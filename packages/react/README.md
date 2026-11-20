# @shivaedev/react

React screens should not rebuild loading, refresh, save and session rules around every native Effect atom. This package gives queries and actions readable state, joins a record to its editable form, and keeps each session's client state together.

Live query screens and route loaders receive their first authorized result on the subscription in one RPC request. Later matching commits rerun that subscriber’s authorized query on the server and push its changed result.

## Why you want this

A refresh should not blank a useful screen. A save response should not erase what someone typed while waiting. Signing in as someone else should not inherit the previous person's draft. These hooks and the session boundary handle those transitions around native atoms and forms:

```ts
const editor = useEditor(api.save, { query: api.get.query({ id }), fixed: { id } });
```

`api` is the application's contract binding: `api.save` is a command that carries its runtime and its payload schema, so the editor takes its fields from the payload, fills them from the loaded row and adds `id` to every save. The editor creates the form when the row arrives. A refresh updates untouched fields and keeps edited ones; a save receives the server's normalized result while keeping edits made during the request. The component renders the form and decides what its loading and error messages say.

## Using it

### How to think about it

State belongs to an **atom in a registry**. A query hook reads that atom's native `AsyncResult`; an action hook reads and dispatches a native action atom. Two readers of the same query share its execution. Changing the query atom resets displayed data by default. An application can use `useQuery(atom, { keepPreviousData: true })` to keep the last successful value while a changed payload loads or fails. This retained display belongs to the hook and clears when its registry changes; native atoms still own execution and caching. Editors keep the default reset so a new record starts a new form.

`useQuery` and `useAction` turn native results into `data`, `cause`, `pending` and `refreshing`. Queries also expose `refusal`, the typed error excluding RPC transport failures; use it for per-query error text during a connection interruption. `cause` and `result` retain the native transport failure for diagnostics. `QueryView` renders its failure slot for refusals and throws defects, while retained data stays visible during transport recovery. A query's same-identity refresh always keeps the last successful value, including after a typed failure, so a component can show data and an error together. An action uses the native result's retained success. Keep the atom's identity stable for the same work: declare it outside render or use the native family's identity, such as `AtomRpc.Service.query(...)`.

An **editor** joins a query atom, a form field schema and a save Effect. The query provides the row; `values(row)` converts it to input values; the schema decodes those values before the save runs. form owns the draft and the per-field merge. A **create form** uses the same submission rules without a query and starts a fresh form after success.

Use `useConnectionStatus(client)` from `@shivaedev/react/client/adapters/useConnectionStatus.ts` with the client returned by contract's `makeClient`. It returns one `"live" | "reconnecting" | "waiting-for-connection"` value across mounted queries from every binding on that client's `Client` service. Live subscription status changes debounce for 300 ms on the client runtime's Clock. A bound command held for reconnection reports `"waiting-for-connection"` immediately, so the application can show Reconnecting while keeping the action pending. Contract holds unsent commands for up to 10 seconds and returns a typed `RpcClientError` on timeout; commands already sent are never replayed. The default socket probes Ping/Pong on browser or native resume and reconnects after 2.5 seconds without a Pong. A query refusal is separate from connectivity. Visible browser `online` and `visibilitychange` signals interrupt the live retry delay and reconnect immediately with a fresh backoff schedule.

Use `useFirstSettled(client)` from `@shivaedev/react/client/adapters/useFirstSettled.ts` with the same client to reveal a session's first screen in one step instead of one loading state per query. It returns `false` until the screen that calls it has rendered once and, with that, no query mounted on the client awaits a first result and no command is in flight, so a first screen that reads no query, such as a blank form, turns it `true` as soon as it has rendered. From then on it returns `true` for that client: a later command or a newly mounted query does not turn it back. A query the screen mounts only after its first render, from an effect or a state change, is not waited for: the reveal shows that query's own loading state. Render TanStack routes with `RouterProvider` from `@shivaedev/react/adapters/routerProvider.ts`, which takes TanStack's props and renders TanStack's provider: it holds `useFirstSettled` until the first route has rendered, so the hook gives the right answer above the router too. Above TanStack's own `RouterProvider` the hook turns `true` before the first route exists. The signal belongs to the client, so a new session generation whose `connect` makes a new client starts at `false` again. A query that only the session's [warm list](#keep-queries-warm-for-the-session) mounts does not hold it back while it awaits its first result, and a query that shows a [stored](#keep-query-results-across-a-reload) or retained result does not hold it back while it revalidates, so a reload with stored results is revealed at once.

A **session generation** is the string returned by `identify(session)`. `SessionBoundary` owns its client, registry and React subtree. Your auth owner supplies the session and decides when to replace or end it. The boundary automatically mounts live connections on bound contract APIs returned by `connect`, directly or as client properties such as `api`. Use a Platform database host and the default shared WebSocket client; the application needs no subscribe handler or `live()` call. The process holding the socket reloads the session and runs the read policy and handler for each subscriber independently. It stores one encoded-result hash per subscribed query in memory and pushes changed values; equal reads acknowledge completion without replacing the screen. Each subscription has at most one rerun in flight and one pending, merging further changes while busy. Other subscriptions run independently in parallel. Backlog overflow triggers a server `Resync`: the server reruns queries itself, and the client sends no follow-up reads. Query results stay in their native registry; RPC declarations and transport stay with native Effect and the application; this package supplies their React state and lifecycle boundary.

An explicit query refresh keeps the current data visible while reporting pending until the new subscription result arrives. Retryable connection failures keep that data visible during reconnection. Render read denials before retained data; replacing or ending the session disposes its registry.

Bound contract queries keep their last successful result for five minutes after the last reader leaves. Opening the same query in that window shows the kept value immediately with `stale: true` and `refreshing: true`, then replaces it when revalidation answers. Query execution and subscriptions stop while nobody reads. At most 100 idle results are kept per registry; the least recently left query is evicted first. Active readers do not consume that allowance. Set `queryRetention={{ timeToLive: "1 minute", capacity: 50 }}` on `SessionBoundary` to change these bounds; zero for either disables idle retention. To keep results across a reload, see [`persist`](#keep-query-results-across-a-reload). Settings apply when a query becomes idle. Expiry uses the query runtime’s Effect Clock. Signing out or changing `identify(session)` disposes every kept result with the session registry. Results belong to individual queries, with no record sharing between them.

`useEditor` and `useCreate` opt into persisted input with `persistedDraft: { key, ...persistence }`. Choose a stable key for the record or create request, independent of its server revision. Acquire `persistence` with `draftPersistence` from `@shivaedev/form/adapters/draftPersistence.ts`, provided with `browserDraftStorage` from `@shivaedev/form/adapters/browserDraftStorage.ts`. The setup reads the storage provider and Clock from the Effect environment; timestamps and expiry use that captured clock. The hooks inherit ownership from `SessionBoundary`: reload and query refresh preserve edits, successful submission clears accepted input, and a committed session replacement drops tracked drafts. A suspended replacement that is canceled keeps the visible session's draft and future writes. Later edits made during a save remain persisted. Observed draft storage shares changes across editors while preserving locally edited fields; a completed older save cannot clear a newer stored draft. Supply `DraftStorageProvider` for custom storage; optional `maxBytes` and `maxAgeMs` customize the bounds, which default to 256 KiB of UTF-8 JSON and seven days. See [form's persisted input API](https://github.com/ShivaeDev/platform/tree/main/packages/form#persist-input-across-reloads) for direct form hooks and limits.

### 1. Once per application

Set up the registry or session boundary at the application root, bind each session's contract APIs there and mount the notice host inside it.

#### Own the registry and the session

For a screen without a session boundary, wrap it in the native provider:

```tsx
import { RegistryProvider } from "@effect/atom-react";

export function App() {
	return (
		<RegistryProvider>
			<Orders />
		</RegistryProvider>
	);
}
```

`Orders` is the application's feature component. For authenticated screens, use `SessionBoundary` at the authenticated root instead:

```tsx
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import { makeOrderClient, OrderScreens } from "./orders.tsx";

interface Session {
	readonly id: string;
	readonly user: { readonly id: string };
}

export function App({ session, recheck }: { readonly session: Session | undefined; readonly recheck: () => void }) {
	return (
		<SessionBoundary
			session={session}
			identify={(current) => current.user.id}
			connect={() => makeOrderClient()}
			recheck={recheck}
			signedOut={<p>Signed out</p>}
		>
			{(client) => <OrderScreens client={client} />}
		</SessionBoundary>
	);
}
```

`makeOrderClient` and `OrderScreens` belong to the application; this example uses the current session cookie. Identify by user id by default: rotating a session after a password change keeps the signed-in screen's state. Identifying by session id is an explicit choice that discards state on rotation. A changed generation creates a new client and registry, acquires a socket with the current session cookie, remounts the screens and disposes the outgoing registry. Independent registries for the same generation share the socket. `undefined` renders `signedOut`. Updating the session object with the same generation keeps the existing client: `connect` does not receive a rotated token until the identity changes. If a client captures a token, either read the current token per request or explicitly include the session id or credential generation in `identify`, accepting a remount on rotation.

Pass the signed-out router as `signedOut` and the requested continuation address as `redirectTo` (for example, the sign-in route's `returnTo` search value). On successful sign-in, the auth owner supplies the new `session`; the boundary unmounts the signed-out tree before replacing the URL, then mounts the signed-in tree at that address. The sign-in screen requests a session recheck after success; it leaves navigation to the boundary. Off-site, non-HTTP and malformed targets fall back to `/`. A same-origin destination keeps its path, query and fragment. The default replacement uses browser history. Supply `navigate={(href) => history.replace(href)}` for a router history such as TanStack's memory history; the callback receives only the checked local path. Navigation happens once when entering a generation, so a same-user session rotation does not navigate again.

A query that fails with an `Unauthorized` from `@shivaedev/errors/taxonomy.ts` asks `recheck` to run and keeps its retained data. An action does the same once per failed result, retaining its last successful `data` and the typed failure in `cause`; rerendering that result does not repeat the recheck. A live reconnect requests a check only for a typed `Unauthorized` authentication refusal; dropped sockets and unreachable servers leave the session alone. Pass the auth owner’s session-refresh Effect as `recheck` (for example, `recheck={auth.session.refresh}`). The boundary shares an in-flight check, retries failures after 1, 2, 4 seconds and so on up to 30 seconds, and retries immediately on visible `online` or `visibilitychange` events while a check is pending, restarting an in-flight check too. Session replacement and unmount cancel retries. Supply `runtime` on `SessionBoundary` to run these retries on a native atom runtime, including one carrying a story’s controlled Clock. Existing void callbacks remain supported; they keep their own check and retry policy. Keep retained session data on screen when a refresh exposes a failure, and pass `session={undefined}` only after a definite signed-out answer. The auth owner decides whether the session ends. The boundary also handles React StrictMode's effect replay and preserves component state across hiding and revealing an `<Activity>` subtree, supplying a live registry when revealed.

#### Keep queries warm for the session

A screen's first visit, and a return after retention let its result go, wait one subscription round trip. Name the queries whose screens should open with current data in `SessionBoundary`'s `warm`, a function of the session's client that returns bound query atoms:

```tsx
<SessionBoundary
	session={session}
	identify={(current) => current.user.id}
	connect={connect}
	recheck={recheck}
	warm={(client) => [client.water.day.query({ date }), client.notes.list.query()]}
	signedOut={<SignIn />}
>
	{(client) => <Screens client={client} />}
</SessionBoundary>;
```

`connect`, `date`, `SignIn` and `Screens` belong to the application; `date` is its own value, for example derived from `useNow`. The boundary mounts each listed query in the session's registry when the generation commits and keeps it subscribed until the session ends: sign-out, another user or unmount. The host pushes its changes, so a screen that reads it later renders the current value in its first render, with no request of its own. The list is read again on every render and compared by atom identity, and bound query atoms are cached per payload: when `date` changes, the new day's query opens and the previous one is handed to retention like a screen that closed. A warm query that no screen reads does not hold back `useFirstSettled`.

Each warm query holds one subscription on the host for the whole session, with its stored result hash and a rerun on each matching change, whether a screen shows it or not. The list must name the payload the screen reads: a query whose payload no screen asks for subscribes for nothing, and that screen stays cold.

#### Keep query results across a reload

A reload or relaunch starts with an empty registry, so the first screen waits for the session check, the socket and the first read. Pass a storage Layer as `persist`, and the last results show at once instead:

```tsx
import { browserQueryStorage } from "@shivaedev/contract/adapters/browserQueryStorage.ts";

<SessionBoundary session={session} identify={(current) => current.user.id} connect={connect} recheck={recheck} persist={browserQueryStorage}>
	{(client) => <Screens client={client} />}
</SessionBoundary>;
```

Every bound query result that retention keeps is also written to the device under the user that `identify` names, in IndexedDB with `browserQueryStorage`. A result is written within a second of settling on the query runtime's Clock, and at once when the page hides. Storage keeps at most `queryRetention.capacity` results (100 by default) and about 5 MB of encoded results (`queryRetention={{ storedBytes }}` changes it), and drops the least recently settled first. When a generation starts, the boundary reads that user's stored results before it renders the first screen, and they seed retention: `useQuery`, a route's `useQuery()`, `QueryView` and `loadQuery` see a stored result as they see a retained one, with `stale: true` and `refreshing: true`, and a route loader commits at once while the subscription revalidates it. Each result is encoded with its operation's success schema; nothing is declared per query. Every result of a query the session reads is stored on the device, whatever its model marks. Fields a model keeps server-only never reach the client, so they are never stored. An application that does not want results at rest leaves `persist` off.

The boundary wipes stored results when `session` becomes `undefined` (a sign-out or a signed-out answer of the session check, including at launch) and the previous user's results when another user signs in. A query that answers `QueryReadDenied` or `NotFound`, or whose stored value no longer decodes, loses its entry. Storage the browser refuses leaves the generation without stored results.

With a [remembered session](#better-auth-actions), give `authSession`'s `remember` and `persist` one Layer, so the two are wiped together:

```ts
import { Layer } from "effect";
import { browserQueryStorage } from "@shivaedev/contract/adapters/browserQueryStorage.ts";
import { browserSessionMemory } from "@shivaedev/identity/client/adapters/browserSessionMemory.ts";

export const deviceStorage = Layer.merge(browserSessionMemory, browserQueryStorage);
// authSession(read, { remember: deviceStorage }) and <SessionBoundary persist={deviceStorage} …>
```

Identity's `forgetSession` then wipes the stored results with the memory, which covers a passed expiry at launch as well. A sign-out through `SessionBoundary`'s `signOut` action wipes both as soon as the sign-out request succeeds, even when the session check after it never answers. Dispatch that action with [`useSignOut`](#better-auth-actions), which runs it in the auth owner's registry where the boundary watches it.

What this means for the person using the application: their data rests on the device, readable by anyone using that browser profile. Signing out on another device cannot erase it until the application next runs online here. A stored result can be days old; it shows as updating until the live result arrives, one subscription round trip after the socket opens.

#### Session-scoped bindings

A contract declared with `keyScope: "session"` binds to the registry that owns the session's queries. In the browser, `bind` prefixes every client read and invalidation key of that contract with an opaque id of its registry, so a successful command in one session refreshes none of another session's queries on the page, even when both registries share one runtime. The server adds no prefix: its subscriptions and committed writes use plain keys, and each query's read policy decides what a viewer receives. The [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/contract/README.md#session-owned-keys) describes the declaration and its handlers. `SessionBoundary` passes that registry to `connect` as its second argument:

```tsx
import { bind } from "@shivaedev/contract/bind.ts";
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";

<SessionBoundary
	session={session}
	identify={(current) => current.user.id}
	connect={(_, registry) => bind(Preferences, makePreferencesClient(), { registry })}
	recheck={recheck}
	signedOut={<p>Signed out</p>}
>
	{(api) => <PreferencesScreen api={api} />}
</SessionBoundary>;
```

`Preferences` is the application's session-scoped contract, and `makePreferencesClient()` creates its native AtomRpc service using the current session cookie. A one-argument `connect` callback also works. The boundary allocates the registry before calling `connect`; an unchanged generation keeps its binding and state. Account replacement, sign-out and same-account re-entry dispose the old registry, private query tracking, live registrations and pending refreshes. Use the user id for cookie-based clients so session rotation keeps state. A sign-out followed by sign-in creates a new registry even for the same user.

#### Connections with several modules

The session boundary finds bound APIs through nested objects and arrays at any depth, including `client.api.notes`. Shared objects and cycles do not mount a binding twice. Use contract's `composeBindings` to select an explicit list instead of discovering the bindings in that object. The client can keep its application modules nested:

```ts
import { composeBindings } from "@shivaedev/contract/composeBindings.ts";

function connect(session: Session, registry: AtomRegistry.AtomRegistry) {
	const modules = [notesModule(registry), tasksModule(registry)];
	return composeBindings(
		{ modules },
		modules.map((module) => module.api),
	);
}
```

`Session`, `notesModule` and `tasksModule` belong to the application; each module binds its contract with the supplied registry. Import `AtomRegistry` from `effect/reactivity/AtomRegistry`. Return the resulting connection from `SessionBoundary`'s `connect` callback and render `client.modules` in its child.

#### Resume from a native shell

For a native shell, pass its resume source when binding the API returned by `connect`:

```ts
import { bind } from "@shivaedev/contract/bind.ts";
import type { ResumeSource } from "@shivaedev/contract/resume.ts";
import { onAppResume, onNetworkReturn } from "./native-lifecycle.ts";

const resume: ResumeSource = (notify) => {
	const stopApp = onAppResume(notify);
	const stopNetwork = onNetworkReturn(notify);
	return () => {
		stopApp();
		stopNetwork();
	};
};
const connect = () => bind(Notes, Client, { resume });
```

`Notes` and `Client` are the application's contract and native AtomRpc client. The application implements `onAppResume` and `onNetworkReturn`, each returning its unsubscribe function. `SessionBoundary` mounts the bound connection, and native notifications reopen the subscription and reconcile its tracked queries alongside the browser visibility and online defaults. Disposing the session's registry releases the native listeners. Omitting `resume` keeps the browser defaults.

#### Detect a deployment and activate a staged update

Configure the host's `config.buildVersion` with the deployed build ID and embed that same ID in the browser bundle. Create one `deployUpdate` from `@shivaedev/react/client/deployUpdate.ts` per registry owner. Pass the same connection options as the application's contract clients so version announcements share their live socket. `useDeployUpdate` from `@shivaedev/react/client/adapters/useDeployUpdate.ts` mounts the controller and exposes `version`, `available`, `blocked`, the native `activation` result and `reload`.

```tsx
import { Effect } from "effect";
import { deployUpdate } from "@shivaedev/react/client/deployUpdate.ts";
import { useDeployUpdate, useUpdateBlocker } from "@shivaedev/react/client/adapters/useDeployUpdate.ts";

const update = deployUpdate({
	url: `${location.origin}/rpc`,
	loadedVersion: BUILD_VERSION,
	activate: Effect.promise(() => stagedUpdate.activate()),
	reload: () => location.reload(),
});

function UpdateNotice({ saving, sheetOpen }: { saving: boolean; sheetOpen: boolean }) {
	useUpdateBlocker(update, saving || sheetOpen);
	const state = useDeployUpdate(update);
	return state.available ? <button onClick={state.reload}>Reload application</button> : null;
}
```

`BUILD_VERSION` and `stagedUpdate` are supplied by the application. Build IDs are opaque strings: a differing host ID means the loaded bundle has been superseded, including after a rollback. A host restart announces its ID through RPC after reconnect; there is no health polling. While visible or blocked, the controller leaves activation to the reload action. When hidden with no registered blockers, it runs the application's activation Effect once for that version. A successful activation clears `available`; a typed activation failure keeps reload available. Omit `activate` when the application has no staged-update mechanism; reload stays available even while hidden. UI wording and confirmation belong to the application.

Each `useUpdateBlocker(update, true)` holds its own blocker until it becomes false or unmounts. Code outside React can run `update.block` with the same `AtomRegistry` service; it returns a release function. Hold it around pending work and call that function when the work ends. All blockers must release before hidden activation proceeds.

#### Mount the notice host

Mount `NoticeHost` from `@shivaedev/react/client/notices.ts` once, inside `SessionBoundary` and above the screens. Every bound command and form save publishes the failures its screen does not handle there, so ordinary screens carry no failure wiring; [Failures of commands and saves](#failures-of-commands-and-saves) says which failure goes where. The host owns a native atom collection, dismissal, expiry and each notice action's native `AsyncResult`. Without `render`, a notice renders as a `div` whose `data-notice` is its kind, with `role="status"` for a success and `role="alert"` otherwise, its message in a paragraph, its action button and a Dismiss button. Supply `render(notice)` to choose markup, wording for action outcomes and labels. Render `notice.action.run` as a button handler and disable that control with `notice.action.pending`; `notice.dismiss` removes the entry. No command requires a host. Expiry sleeps on the `Clock` of the optional `runtime` prop, an atom runtime such as `client.runtime`; without it, the host uses Effect's default clock. A story can pass a runtime built with `Layer.succeed(Clock.Clock, clock)` and drive expiry with `TestClock.adjust`.

```tsx
import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { UnexpectedFailure } from "@shivaedev/react/client/unexpectedFailure.ts";
import { NoticeHost, type Notice } from "@shivaedev/react/client/notices.ts";

function renderNotice(notice: Notice) {
	const action = notice.action;
	return (
		<article role="status">
			<p>{notice.message}</p>
			{action && (
				<button disabled={action.pending} onClick={action.run}>
					{action.label}
				</button>
			)}
			{action && AsyncResult.isSuccess(action.result) && <p>Undo completed</p>}
			{action && AsyncResult.isFailure(action.result) && <p>{Cause.pretty(action.result.cause)}</p>}
			<button onClick={notice.dismiss}>Dismiss</button>
		</article>
	);
}

function failureNotice(failure: UnexpectedFailure) {
	return failure.kind === "connection" ? { message: "You are offline. Your changes were not sent." } : { message: failure.message };
}

function SessionScreens({ client }: { readonly client: AppClient }) {
	return (
		<NoticeHost failure={failureNotice} render={renderNotice}>
			<OrderScreens client={client} />
		</NoticeHost>
	);
}
```

`AppClient` and `OrderScreens` belong to the application; return `SessionScreens` from the session boundary's child function. The renderer receives `id`, `kind` (`"success"`, `"rejection"` for a rejection the server sent, `"failure"` for a failure the host worded), `message`, `dismiss` and an optional action with `label`, `run`, `pending` and `result`.

`failure(unexpected)` is the application's one place for the failures that belong to the framework rather than to a screen: a lost connection (`RpcClientError` or `WebSocketRequired`), a server outage (`ServiceUnavailable` or `AuthUnavailable`), an `InternalServerError`, a defect and any untagged failure. It receives `{ kind, message, cause }` with `kind` `"connection"`, `"unavailable"` or `"unexpected"`, and returns a descriptor without an action, or `"silent"`. The default shows `message`: `Could not reach the server. Check your connection and try again.` for a lost connection, the server's own message for an outage or an `InternalServerError`, which the server's handler edge has already redacted, and `Something went wrong. Try again.` for a defect or an untagged failure. It never shows a cause or a stack trace; `cause` is there for the application's diagnostics. One failed invocation publishes one notice, however many hooks hold the same operation. Without a mounted host nothing is published, and the failure stays in the hook's `cause`. Action results retain the native success value or failure cause as `unknown`; narrow domain errors in your renderer to choose their wording.

### 2. Once per feature

Each feature reads queries, dispatches commands, binds its forms and reports their outcomes. Routes, permissions and auth screens use the same query and action state.

#### Queries and actions

The hooks accept native atoms directly. This complete component module shows query and action state without RPC setup:

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";

const report = Atom.make(Effect.succeed({ id: 1, title: "Quarterly report" }));
const rename = Atom.fn<string>()((title) =>
	title.trim() === "" ? Effect.fail("Title required" as const) : Effect.succeed({ id: 1, title: title.trim() }),
);

function Report() {
	const query = useQuery(report);
	const action = useAction(rename);
	return (
		<section>
			<QueryView query={query} content={(row) => <h1>{row.title}</h1>} />
			<button onClick={query.refresh}>Refresh</button>
			<button disabled={action.pending} onClick={() => action.dispatch("Annual report")}>
				Rename
			</button>
			{Option.isSome(action.data) && <output>{action.data.value.title}</output>}
			{Option.isSome(action.cause) && <p role="alert">Could not rename</p>}
		</section>
	);
}

export function App() {
	return (
		<RegistryProvider>
			<Report />
		</RegistryProvider>
	);
}
```

`QueryView` from `client/QueryView.ts` is stateless presentation over `QueryState<A, E>`, including an editor's `query`. Supply `content(data, query)`; `loading(query)` and `failure(error, query)` are optional. Without them the view uses the application's defaults, or the package's own: a `role="status"` paragraph reading `Loading…` (`Refreshing…` while retained data shows), and a `role="alert"` paragraph with the failure's message and a Retry button that calls the query's `refresh`. While the retry reads, the loading paragraph shows beside the failure. The default failure shows the message of a shared request rejection or a server failure from `@shivaedev/errors/taxonomy.ts`, and `Could not load. Try again.` for anything else. A query that can fail with a rejection the app declared for itself requires `failure`: the call does not compile without it. Wrap the screens once in `QueryViewDefaults` from the same module, with `failure` or `loading` or both, to choose the application's rendering; a view's own renderer still wins.

The example's action is a native atom, so its failure stays in `cause` and nothing is published; a bound command reports its failures as [Failures of commands and saves](#failures-of-commands-and-saves) describes. Loading renders while pending, including refreshes, or before the first result; a settled initial rejection renders failure without loading. The failure renderer receives the typed rejection and can call the query's native `refresh` to retry. The component keeps successful content in the same React position through refresh, failure and recovery, preserving mounted inputs. Keep content component types and keys stable as usual.

The hook owns retained display data and the native atom owns execution and caching. `QueryView` creates neither. Expected query rejections stay in its failure renderer; defects are thrown to the application's error boundary. It leaves field and command failures with the editor, form or action that owns them. Native `useAtomSuspense` is unchanged and still throws failures.

For both queries and actions, a successful `undefined` is `Option.some(undefined)` in `data`, with `pending` and `refreshing` false. A defect or interruption is available as `Option.some(cause)` in `cause`; they do not request a session recheck, even when the defect has an `Unauthorized` tag.

The example's action returns a value; it does not persist the report or invalidate its query. In an application, pass the bound query and command of a module's generated contract instead:

```ts
const notes = useQuery(api.list.query());
const add = useAction(api.add);

add.dispatch({ title: "Morning walk" });
```

`api` comes from `makeClient` over the module's generated contract, as the [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/contract/README.md#the-wire-and-the-browsers-contract) describes, with a `list` query and an `add` command that takes `{ title }`. The command's success refreshes the queries that read its keys.

An action's `dispatch(input)` returns `void`. Read the atom's latest result from `data`, `cause` or `result`. With the default `Atom.fn` action, a later dispatch interrupts the earlier work and the shared state reports the later result.

#### An editor and a create form

The next module assumes a sibling `invoice-lines-client.ts` exports a contract-bound `api` with `get`, `save` and `create`. `get` returns `{ id, name, quantity }`, `save` takes `{ id, name, quantity }`, `create` takes `{ name, quantity }`, and both commands return the saved row. The [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/contract/README.md) describes that binding.

```tsx
import { useCreate } from "@shivaedev/react/client/create.ts";
import { useEditor } from "@shivaedev/react/client/editor.ts";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import { useField } from "@shivaedev/form/adapters/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { Option, Schema } from "effect";
import { api } from "./invoice-lines-client.ts";

const InvoiceLineFields = Schema.Struct({
	name: Schema.String,
	quantity: Schema.NumberFromString,
});
type Fields = typeof InvoiceLineFields.fields;

function Inputs<A, E, ER>({ form }: { readonly form: Form<Fields, A, E, ER> }) {
	const name = useField(form, "name");
	const quantity = useField(form, "quantity");
	return (
		<>
			<label>
				Name
				<input name="name" value={name.value} onBlur={name.onBlur} onChange={(event) => name.onChange(event.target.value)} />
			</label>
			{name.error && <p role="alert">{name.error}</p>}
			<label>
				Quantity
				<input name="quantity" value={quantity.value} onBlur={quantity.onBlur} onChange={(event) => quantity.onChange(event.target.value)} />
			</label>
			{quantity.error && <p role="alert">{quantity.error}</p>}
		</>
	);
}

export function InvoiceLineEditor({ id }: { readonly id: number }) {
	const editor = useEditor(api.save, { query: api.get.query({ id }), fields: InvoiceLineFields, fixed: { id } });
	return (
		<QueryView
			query={editor.query}
			content={() =>
				editor.form && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							editor.save();
						}}
					>
						<Inputs form={editor.form} />
						<button type="submit" disabled={editor.saving}>
							Save
						</button>
						<button type="button" onClick={editor.query.refresh}>
							Refresh
						</button>
						<button type="button" onClick={editor.revert}>
							Revert
						</button>
						<p>{editor.saving ? "Saving" : editor.dirty ? "Unsaved" : "Saved"}</p>
					</form>
				)
			}
		/>
	);
}

export function InvoiceLineCreate() {
	const create = useCreate(api.create, { fields: InvoiceLineFields, initialValues: { name: "", quantity: "" } });
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				create.save();
			}}
		>
			<Inputs form={create.form} />
			<button type="submit" disabled={create.saving}>
				Create
			</button>
			{Option.isSome(create.created) && <output>Created {create.created.value.name}</output>}
		</form>
	);
}
```

Both hooks take the bound command first. It carries the atom runtime that runs it and supplies the services of schema decoding, and its payload schema. Without `fields`, the form's fields are the payload's fields minus the keys in `fixed`. Pass `fields` when an input holds another encoding than the payload, as here: the inputs hold strings and `InvoiceLineFields` decodes `quantity` to a number before the command receives it. A command whose payload is not a struct needs `fields`.

`fixed` holds the payload fields the form does not edit, such as the record's `id` or an expected version; every save sends `{ ...fixed, ...values }`. `fixed` and the form's fields together must cover the payload exactly. A missing key, a key outside the payload and a value of the wrong type are compile errors that name the key: an editor for `{ id, title, expectedVersion }` given `fixed: { id }` reports `Property 'expectedVersion' is missing`, and `fixed: { owner: "ada" }` reports `Type '"ada"' is not assignable to type '"is not a field of the command's payload"'`. A query passed where a command belongs reports `a bound query only reads: read it with useQuery, and pass a command here`.

An editor fills its inputs by encoding each loaded or saved row with the form's field schemas, without rerunning their checks, because the row already passed its schema. Pass `values(row)` when the row's shape differs from the fields or a field's encoding needs services; the compiler requires it then. A payload field the row lacks must go in `fixed`. Put a payload field the user must not edit, such as `id`, in `fixed` even when the row has it, so it stays out of drafts.

For a save that is not a single bound command, pass `{ run, runtime }`: `run` takes the decoded values and returns the Effect, and `runtime` provides its services. Spread a bound command into it, `{ ...api.save, runtime }`, to run it on another runtime.

The editor's form is absent until its first row arrives. A different query atom creates a new form, so another record starts without the previous draft. Refresh results adopt untouched fields and leave edited fields alone. Saved rows supply server normalization while edits made during the save remain dirty. A refresh failure keeps the draft, and `query.refresh()` retries.

`save()` ignores a second call while saving. Submitting through form's own `useSubmit(form).run()` or setting `form.submit` also settles the editor or create hook: an editor receives the saved row, and a create records its result and resets.

A successful create replaces its form with one at `initialValues`, keeping fields edited after submission began, including while an async schema decoded it. The next entry starts without the previous entry's displayed field errors. `created` holds the successful result as an `Option`.

#### One-shot create and edit

Use `useCreate` when the app already has the opening values and needs one submission. It accepts any command, including an update command; `created` holds the command's successful result. Creation above and the query-free edit below use the same form lifecycle. No upsert or new form hook is needed: creation and update remain separate domain commands with explicit payloads.

For this versioned example, the app's `save` command requires `{ id, expectedVersion, name, quantity }` and returns the row with its new `version`. It rejects a stale version with a tagged `Conflict` error. Reuse `InvoiceLineFields` and `Inputs` from above:

```tsx
import { Option } from "effect";
import { useEffect, useState } from "react";
import { useCreate } from "@shivaedev/react/client/create.ts";

type VersionedLine = {
	readonly id: number;
	readonly version: number;
	readonly name: string;
	readonly quantity: number;
};

export function OneShotEdit({ opening, onSaved }: { readonly opening: VersionedLine; readonly onSaved: (line: VersionedLine) => void }) {
	const [original] = useState(opening);
	const edit = useCreate(api.save, {
		fields: InvoiceLineFields,
		fixed: { id: original.id, expectedVersion: original.version },
		initialValues: { name: original.name, quantity: String(original.quantity) },
	});
	useEffect(() => {
		if (Option.isSome(edit.created)) onSaved(edit.created.value);
	}, [edit.created, onSaved]);
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				edit.save();
			}}
		>
			<Inputs form={edit.form} />
			<button type="submit" disabled={edit.saving}>
				Save
			</button>
		</form>
	);
}
```

The app captures the opening record once. Pass a stable `onSaved` callback to close the dialog, navigate or record a completion message; mount a new form for another opening. Domain data, including expected versions and any Undo payload, stays in the app. A `Conflict` shows the server's message through the notice host and keeps the input; the typed error is also in `failure`. Field rejections stay on the submitted form until corrected; stale-rejection matching belongs to form. Success uses `useCreate`'s normal reset to opening values while preserving input changed during submission, so `onSaved` owns what happens next rather than turning this into a continuing editor.

Use `useEditor` for a continuing editor that subscribes to a record, merges refreshes and receives saved rows as its new baseline. Its `loaded` option supplies the initial row, usually from a route loader; it still requires `query` because the query owns identity, refresh and invalidation. Supplying `loaded` does not make an editor query-free. In either pattern contract owns the command Effect and invalidation, form owns submission and field errors, and react exposes query state where a query exists.

#### Failures of commands and saves

A bound command given to `useAction`, `usePendingCommand` or `useUndoableChange`, and the save of `useCreate` or `useEditor`, decide what each failure shows from its class, so the ordinary screen writes no failure handling:

- A rejection whose `field` names one of the form's fields becomes that field's message (form saves only). `Conflict` and `BadRequest` from `@shivaedev/errors/taxonomy.ts` with a `field`, and a contract `fieldRejection` over the form's fields, land there.
- A shared request rejection from `@shivaedev/errors/taxonomy.ts` (`NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed` or `TooManyRequests`) publishes a notice with the error's `message`. `Unauthorized` also asks the session to recheck.
- A framework failure goes to the notice host's `failure` wording: `RpcClientError`, `ServiceUnavailable`, `AuthUnavailable`, `InternalServerError`, contract's `MissingReadPolicy`, `MissingReadPolicies`, `QueryReadDenied` and `WebSocketRequired`, a defect and any untagged failure.
- A rejection the app declared for itself has no default. The call does not compile until `failures` says what it shows.
- Interrupted work shows nothing.

The framework words every shared rejection it raises for the person using the application, so its message shows as it arrives: a missing session says `Sign in to continue` and a missing permission `You do not have permission to do this.`, with no `failures` handler to undo developer wording. When the same hook's command or save later succeeds, the failure notices it published go without Dismiss; a notice nobody resolves stays until dismissed or expired.

`failureKind` from `@shivaedev/contract/failureKind.ts` holds that classification, `AppRejection<E>` names the app's own rejections in an error type, and `RequestRejection` and `ServerFailure` in `@shivaedev/errors/taxonomy.ts` name the shared ones.

```tsx
function Retitle({ id }: { readonly id: number }) {
	const editor = useEditor(api.retitle, {
		query: api.get.query({ id }),
		fixed: { id },
		failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) },
	});
	return <TitleForm form={editor.form} save={editor.save} />;
}
```

Here `api.retitle` takes `{ id, title }` and can fail with the app's tagged `SubtitleRejected`, which refers to the server's `subtitle` while the form calls the input `title`; `api`, `SubtitleRejected` and `TitleForm` belong to the application. A handler is keyed by the failure's tag and receives the error and the invocation's input, which for a form is its decoded values. It returns a notice descriptor, a field rejection `{ field, message }` naming one of the form's fields (form hooks only), or `"silent"`. In place of a function, `"message"` shows the error's own message as a notice and `"silent"` shows nothing for that tag. A handler may also be given for a shared rejection to word it differently for that call. `silent: true` shows nothing for any failure of the call, which differs from leaving `failures` out: that uses the defaults. The typed failure stays in the hook's `failure` and `cause` in every case.

A missing handler is a compile error that names the tag. `useAction(api.retitle)` with no options reports `Property '"failures.SubtitleRejected"' is missing`, followed by `the operation can fail with SubtitleRejected, a rejection the app declared: say what it shows, for example failures: { SubtitleRejected: "message" }`. Options without `failures` report `Property 'failures' is missing` for a type `HandleAppRejections<"SubtitleRejected", …>`, `failures: {}` reports `Property 'SubtitleRejected' is missing`, and a key that is not a failure of the operation is an unknown property. A form's rejection whose `field` can only name a field the form lacks counts as the app's own and needs a handler.

#### Query, command and form feedback

Use `useQuery` with `QueryView` for reads, `useAction` with a bound command for commands, and `useCreate` or `useEditor` for form submissions. Give these owners success notice descriptors and mount one `NoticeHost` inside the session boundary; failures reach it as the previous section describes. contract still runs commands and invalidates queries; form still owns submission, fields and drafts. The app supplies wording, Undo payloads and expected versions.

`useAction` with a command accepts `notices.onSuccess(value, input)`, which returns a descriptor or `undefined`. Independent concurrent completions publish independently, preserving the invocation's input. `useCreate` and `useEditor` accept the same `notices` option around their existing save Effects. Use the descriptors instead of screen-local notice state, expiry timers or result-watching effects:

```ts
const remove = useAction(api.remove, {
	concurrent: true,
	notices: {
		onSuccess: (removed, input) => ({
			message: `Removed ${input.title}`,
			action: {
				label: "Undo",
				run: api.restore.run({
					id: input.id,
					title: input.title,
					expectedVersion: removed.version,
				}),
			},
		}),
	},
});
```

`api`, the restore payload and its expected version belong to the application. The host runs the supplied Effect with the operation's native runtime, disables repeated dispatch while it is pending and exposes the outcome on that action. A failed Undo stays on its original notice; it does not become another operation failure notice. Command execution and invalidation remain with contract, and form submission remains with form.

For query failures, pass `useQuery(atom, { notice: ({ cause, refreshing }) => descriptor })`. `useEditor` accepts the same callback as `queryNotice` for its query. `refreshing` distinguishes a failure with retained data from an initial load failure. Each settled failed result publishes once per hook; a rerender does not replay it. Omit the callback or return `undefined` for operations that need no notice.

The query and form in the same feature use their own feedback options:

```tsx
const notes = useQuery(api.list.query(), {
	notice: ({ refreshing }) => ({
		message: refreshing ? "Refresh failed" : "Load failed",
	}),
});
const save = useCreate(api.save, {
	initialValues: { title: "" },
	notices: { onSuccess: (title) => ({ message: `Saved ${title}` }) },
});
```

Here `api` belongs to the app, and `api.save` takes `{ title }` and returns the saved title. Render `notes` through `QueryView`: its loading renderer shows pending work, its failure renderer offers `notes.refresh` as Retry, and its content renderer holds the form and command controls. Bind fields with form's `useField`, submit with `save.save()` and disable Save with `save.saving`. A tagged field rejection stays beside that input. A held save keeps newer edits when it completes and publishes its success notice before the invalidated query finishes. A failed refresh keeps the last content and the draft while publishing the refresh notice.

Replacing the session during a command or Undo disposes the outgoing registry: late completion callbacks and outcomes do not publish, and retained notice action and dismiss handlers cannot change the new host.

A descriptor has `message`, optional `expiresIn` as a native Duration, and optional `action: { label, run }`. Without an expiry it remains until dismissed or the host ends. Dismissal, expiry, host unmount and session replacement remove entries, interrupt their expiry sleeps and interrupt pending actions. Native uninterruptible Effects may finish, but their old notice cannot affect the new host. Notices survive screen unmount while their host remains mounted.

#### Completion inside each command invocation

Pass the bound command to `useAction` when the screen needs feedback for each invocation:

```tsx
const rename = useAction(api.rename, {
	notices: {
		onSuccess: (saved, input) => ({ message: `Renamed ${input.id} to ${saved.title}` }),
	},
});
```

`api` belongs to the application. Input, success, typed failure and runtime requirements are inferred from the command. Use `notices` for success notices and `failures` for the wording of a failure. The optional synchronous `onSuccess(value, input)` and `onFailure(error, input)` callbacks are also available for application completion work. They run inside each invocation using the latest committed callbacks and that invocation's input and outcome. Rerendering a result does not replay completion, and an abandoned render cannot replace the committed callback. A callback that throws becomes a native defect; it does not call `onFailure` as a domain rejection.

The command's identity is the native action atom, or the operation's `run` function and `runtime`. A bound command such as `api.rename` keeps both; memoize a custom `run` in `{ run, runtime }` with `useCallback` or `useMemo`. A `run` written inline in the component is a new function on every render: its next render fails with an error that names `useAction`, says `run` must stay the same function and gives this fix, where React alone reports only `Too many re-renders`. Changing the command on a mounted control keeps `pending` true until its outgoing request settles. Its result, data and cause stay with the outgoing command: a refusal or success from Launch never appears on a replacement Resume control. Resume dispatches its own function and input. Completion callbacks for the outgoing runtime command stop when it is replaced; callbacks for the same command still use the latest committed props.

The hook calls the supplied Effect once. A bound contract command still owns invalidation, and completion does not wait for server query reruns and their pushed results. Undo payloads, expected versions and presentation text stay in the application.

A newer dispatch interrupts the earlier command by default. Interrupted work produces no completion feedback. Pass `{ concurrent: true, onSuccess, onFailure }` to let invocations overlap and report their own outcomes. `result`, `data`, `cause` and `pending` remain the native action atom's aggregate state, including its native result selection during concurrent execution; they do not identify an invocation. Use notice descriptors for per-invocation messages and completion callbacks for application work. Keep the runtime and concurrency policy stable for the same owner.

A typed `Unauthorized` failure shows its message and asks the session owner to recheck once per failed invocation, even with concurrent commands. The hook does not sign out. Session replacement discards outgoing callbacks and rechecks, including when outgoing work cannot be interrupted.

#### Remove with a version-guarded Undo

Use `useUndoableChange` from `@shivaedev/react/client/adapters/useUndoableChange.ts` when a versioned command also performs its inverse. Its payload includes `expectedVersion: number`, and its success includes `version: number`. Pass the bound command, and the application's `deployUpdate` as the `update` option:

```tsx
import { Option } from "effect";
import { useUndoableChange } from "@shivaedev/react/client/adapters/useUndoableChange.ts";

function RemoveNote({ note }: { readonly note: { id: string; version: number } }) {
	const change = useUndoableChange(api.change, { describe: (saved) => `Removed ${saved.id}`, update });
	const notice = Option.getOrUndefined(change.notice);
	return (
		<>
			<button
				disabled={change.pending}
				onClick={() => change.remove({ id: note.id, expectedVersion: note.version, removed: true }, { id: note.id, removed: false })}
			>
				Remove
			</button>
			{notice && (
				<p>
					{notice.message}
					<button disabled={change.undoing} onClick={change.undo}>
						Undo
					</button>
				</p>
			)}
		</>
	);
}
```

`api`, the soft-removal payload and `update` belong to the application. `remove(input, inverse)` captures the inverse domain fields. `undo()` sends those fields through the same command with `expectedVersion` set to the successful removal's returned `version`. The server must enforce that version and declare its typed conflict; a later edit then refuses Undo without overwriting the row. `removeResult` and `undoResult` preserve the native `AsyncResult`, including typed failures. Successful Undo clears its notice; a failed Undo leaves it available.

For a batch command, supply `undoInput(value, input)` to build the complete inverse payload from its successful result and original input. This overload accepts any command payload and success shape and uses `remove(input)` with no second argument:

```tsx
const change = useUndoableChange(api.editEntries, {
	describe: () => "Changed diary entries",
	undoInput: (saved) => ({ _tag: "undo" as const, token: saved.undo }),
	update,
});
change.remove({ _tag: "edit", rows: selectedVersions, scale: 0.5, copies: true });
```

`api.editEntries` and the payload shape belong to the application. The hook captures the inverse when the command succeeds and submits it unchanged through the same command on Undo. The result can carry a set of row versions with their previous values, or an opaque server-issued undo token; neither requires a top-level `expectedVersion` or `version`. The server owns the transaction: restore each changed row under its own returned version, remove rows the batch created under their own guards, and reject the whole inverse with a typed conflict if any guard is stale. React stories exercise portion scaling, copy removal and stale guards against PostgreSQL; the hook supplies no database undo engine.

`notice` is a native `Option` containing `message`, the submitted `input` and returned `value`. Only the most recently dispatched removal can publish it, even when replies arrive in reverse order. An older Undo cannot clear a newer notice. `removing` and `undoing` describe the two writes, and `pending` includes either. Each invocation holds `update.block` for its whole Effect lifetime, so overlapping writes hold deployment activation until all finish. The hook keeps UI wording and inverse domain data in the app; no `NoticeHost` is needed.

#### Commands with a pending display value

Use `usePendingCommand` for a command acting on a query row, such as a list toggle. Pass the bound command, the row's current server value and the display value an input asks for:

```tsx
import { usePendingCommand } from "@shivaedev/react/client/pendingCommand.ts";

function EnabledToggle({ row }: { readonly row: { readonly id: number; readonly enabled: boolean } }) {
	const command = usePendingCommand(api.toggle, { value: row.enabled, wanted: (input) => input.enabled });
	return (
		<button
			aria-pressed={command.value}
			disabled={command.pending}
			onClick={() => command.dispatch({ enabled: !command.value, id: row.id })}
			type="button"
		>
			Enabled
		</button>
	);
}
```

The example assumes a bound `api.toggle` that takes `{ id, enabled }`. Its `run` and `runtime` are the command's identity and must stay the same between renders, as for `useAction`. Each use of the hook owns its action state, so one row can fail while another keeps its requested display.

`command.value` changes on dispatch and holds the requested value until the command is [reflected](https://github.com/ShivaeDev/platform/blob/main/packages/contract/README.md#when-a-commands-change-is-on-the-screen): every live query open on the connection shows the server's state after it. A switch backed by a live query therefore does not fall back to the old server value between the command's reply and the server's update, and a command that changes nothing frees the switch without an update. `pending` covers that whole interval, and `result`, `data` and `cause` settle when it ends. After the hold ends, `value` follows the server again, even if it differs from the requested value. A command failure immediately returns to the server value and remains typed in `result` and `cause`, just as with `useAction`. This binding holds a display value; it applies no optimistic update and does not write to the query cache.

Queries the client reloads itself, such as those of a client made with `live: false`, are not part of a command's reflection. List them as `queries`, an array that keeps its identity between renders, and the hold also lasts while any of them is reloading; `result` can then already be successful while `pending` still waits. `queries` adds no invalidations.

#### Trace an action across RPCs

Editor saves and create submissions automatically run their save Effect in a fresh `ui.submit` trace. For custom actions, wrap the Effect that performs the action with `actionTrace` before giving it to a native atom:

```ts
import { Effect } from "effect";
import { actionTrace } from "@shivaedev/react/actionTrace.ts";

const save = OrdersClient.runtime.fn((input: OrderInput) =>
	actionTrace(
		Effect.gen(function* () {
			yield* api.validate.run(input);
			return yield* api.save.run(input);
		}),
		"ui.saveOrder",
	),
);
```

`OrdersClient`, `OrderInput` and `api` belong to the application. Dispatch `save` with `useAction(save)`. `actionTrace(effect, name?)` preserves the Effect's result, typed error and service requirements; its default span name is `ui.action`. Each execution starts a fresh trace, and RPCs run inside that Effect share it, including across asynchronous boundaries. Native atoms continue to own execution and cancellation. `useAction` also accepts ordinary native action atoms; wrap composite action Effects to group their RPCs.

With native `RpcClient.layerProtocolHttp` and `FetchHttpClient.layer` as the browser RPC protocol, Effect sends the trace in the W3C `traceparent` HTTP header on each request. On the `appHost` of `@shivaedev/server`, each RPC's server span joins that trace with a `request.id` attribute, and the SQL its handler runs joins it too. Wrap a handler's enqueue in an application-named producer span, such as `Effect.withSpan("Receipt.enqueue", { kind: "producer" })`, to show it in the action's trace. Each worker attempt runs in its own trace, linked back to that span; [jobs' tracing](https://github.com/ShivaeDev/platform/blob/main/packages/jobs/README.md#trace-jobs) describes the job span.

#### Route loaders with TanStack Router

TanStack Router owns routes, navigation, search validation, loader data and screen components. Mount the router with `RouterProvider` from `@shivaedev/react/adapters/routerProvider.ts` in place of TanStack's: it renders TanStack's provider unchanged and tells the session's `useFirstSettled` when the first route has rendered. Declare a route's query once with `queryRoute(buildQuery)` from `@shivaedev/react/client/adapters/queryRoute.ts`, spread the result into `createRoute`, and call its `useQuery()` in the route's component. The spread derives loader dependencies from validated search and loads the contract query atom in the router context’s registry; `useQuery()` reads the same atom, so the component names neither the operation nor its arguments. A `NotFound` instance from `@shivaedev/errors/taxonomy.ts` or a `QueryReadDenied` refusal enters TanStack's not-found handling with the original rejection in the not-found component's `data` prop, preserving its message. One root `notFoundComponent` can show that message for all query routes; a route's own `notFoundComponent` takes precedence. Other typed failures reach `errorComponent` unchanged. The atom runs through its native RPC runtime and shares its execution with React. The factory receives `{ context, params, search }`: `context` is the loader’s router context, including parent `beforeLoad` contributions. Annotate it with `typeof root.types.allContext` (or the parent route’s `types.allContext`) to keep client and viewer access checked against the route’s declaration.

This example assumes an application-owned `api.get.query({ id, page })` returning `{ id, title }`, with declared `NotFound` and `NoteMissing` rejections:

```tsx
import { RegistryContext } from "@effect/atom-react";
import { createRootRouteWithContext, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import type { ErrorComponentProps, NotFoundRouteProps } from "@tanstack/react-router";
import { Effect, Option, Predicate, Schema } from "effect";
import type { ReactNode } from "react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { RouterProvider } from "@shivaedev/react/adapters/routerProvider.ts";
import { queryRoute } from "@shivaedev/react/client/adapters/queryRoute.ts";
import { api } from "./notes-client.ts";

const registry = AtomRegistry.make();
const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry; api: typeof api }>()({
	notFoundComponent: SharedNotFound,
});
const Search = Schema.Struct({
	page: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
		Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
		Schema.withDecodingDefaultKey(Effect.succeed(1)),
	),
});
const noteQuery = queryRoute(
	({ context, params, search }: { context: typeof root.types.allContext; params: { id: string }; search: typeof Search.Type }) =>
		context.api.get.query({ id: params.id, page: search.page }),
);
const note = createRoute({
	getParentRoute: () => root,
	path: "/notes/$id",
	validateSearch: Schema.toStandardSchemaV1(Search),
	...noteQuery,
	component: Note,
	errorComponent: Failure,
});
const router = createRouter({
	context: { registry, api },
	routeTree: root.addChildren([note]),
	defaultPendingMs: Infinity,
	InnerWrap: Shell,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function Shell({ children }: { readonly children: ReactNode }) {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<main>
			{pending && <p>Loading…</p>}
			{children}
		</main>
	);
}
function Note() {
	const query = noteQuery.useQuery();
	return <h1>{query.data.title}</h1>;
}
function Failure({ error }: ErrorComponentProps) {
	const retry = noteQuery.useRetry();
	return (
		<>
			<p role="alert">{Predicate.isTagged(error, "NoteMissing") ? "Note missing" : "Could not load"}</p>
			<button type="button" onClick={() => void retry()}>
				Retry
			</button>
		</>
	);
}
function SharedNotFound({ data }: NotFoundRouteProps) {
	return <h1>{Schema.is(NotFound)(data) ? data.message : "Page not found"}</h1>;
}
export function App() {
	return (
		<RegistryContext.Provider value={registry}>
			<RouterProvider router={router} />
		</RegistryContext.Provider>
	);
}
```

`SharedNotFound` narrows `data` with the shared rejection schema before reading the server's message. The fallback handles not-found results without that rejection, such as unmatched URLs.

`validateSearch` stays native: `Schema.toStandardSchemaV1(Search)` supplies TanStack’s search input and output types. The schema defaults a missing or invalid page to `1`. The query callback names its params and schema output type because TypeScript cannot infer them backward through an object spread. Changing search changes the loader dependencies and queries the new payload. Keep `params`, `validateSearch`, `component` and `errorComponent` on the route, with an optional `notFoundComponent` to override the shared screen; options after the spread can override its `loaderDeps` or `loader`.

Keep the result of `queryRoute` to call its `useRetry()` hook inside that route's error component. The returned callback refreshes the query using the current match's params, decoded search dependencies and context, then invalidates that match. A successful retry renders the route again without replacing the surrounding shell or its draft inputs.

State where a signed-out visitor goes once, as `redirects.signedOut` in the router's context. A query route whose query fails with the shared `Unauthorized` rejection redirects there, and `permissionGuard` takes the same callback. `signInRedirect(path)` from `@shivaedev/react/adapters/signInRedirect.ts` builds it: a TanStack redirect to `path` that carries the requested path, search and fragment in sign-in's `returnTo` search field. `redirects.refused` handles `Forbidden` and `QueryReadDenied` the same way, with a callback that returns TanStack's `redirect`. A route overrides either target for its own query with `queryRoute(buildQuery, { redirects })`, as `memberNote` does here:

```ts
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { QueryRouteRedirects } from "@shivaedev/react/adapters/queryRouteFailure.ts";
import { signInRedirect } from "@shivaedev/react/adapters/signInRedirect.ts";
import { queryRoute } from "@shivaedev/react/client/adapters/queryRoute.ts";
import { api } from "./notes-client.ts";

const registry = AtomRegistry.make();
const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry; api: typeof api; redirects: QueryRouteRedirects }>()();
const memberNote = createRoute({
	getParentRoute: () => root,
	path: "/members/$id",
	...queryRoute(
		({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: object }) =>
			context.api.get.query({ id: params.id, page: 1 }),
		{ redirects: { signedOut: signInRedirect("/members/sign-in") } },
	),
});
const router = createRouter({
	context: { registry, api, redirects: { signedOut: signInRedirect("/sign-in") } },
	routeTree: root.addChildren([memberNote]),
});
```

Without a callback at either level, failures keep their normal error or not-found handling. `NotFound` continues to use the not-found screen even when refusal redirects are configured.

For a loader that coordinates more work, use `loadQuery(registry, atom, loaderContext)` from `@shivaedev/react/adapters/loadQuery.ts` directly. It reads the atom in the supplied registry and throws typed failures unchanged, including `NotFound`; the loader decides how to handle them.

`defaultPendingMs: Infinity` keeps the current route's data visible during navigation; the shell reads TanStack's `isLoading` to display pending state. The new route commits when its loader settles. This is TanStack's pending policy, separate from `useQuery`'s retained display. The loader hands its query over to the route's component: the first render has the loaded value, and the query handler runs once, for a live subscription and for a `live: false` query alike, even when the route mounts after the registry’s idle window.

`useQuery()` reads the current match's params, decoded search, context and loader value, and exposes `data` as the query's success type, with no `Option` or Initial result. It takes the options of `useQuery` from `@shivaedev/react/client/resultState.ts`. Call it inside the route's component or a component it renders. Refetches keep the last value visible. `useQuery`, a route's `useQuery()` and a loader-backed editor’s `query` expose `denied: true` for `QueryReadDenied`, alongside the typed `cause`. Use this state to replace retained content with the application’s not-found screen after access is revoked. Refused live queries stay refused through change notifications until their input or viewer changes. For a loader-backed editor, spread the route's `useLoaded()`, which returns its atom as `query` and the loader value as `loaded`: `useEditor(api.save, { ...noteQuery.useLoaded(), fixed: { id } })`. Its form is defined on the first render and `editor.query.data` is the row directly. A loader written with `loadQuery` reads its atom with `useLoaderQuery(atom, route.useLoaderData())` from `@shivaedev/react/client/useLoaderQuery.ts`, which `useQuery()` uses underneath.

`loadQuery` mounts its query while the loader runs and, once it succeeds, for a five-second hand-over window measured on the bound query's atom runtime `Clock`. A component that mounts within the window continues the loader's subscription and its first result instead of opening another. A route that is left or never mounts releases the query when the window passes; from then on the bound query uses the same retention policy as component reads, including its expiry, capacity and session ownership. A route that mounts after the window shows that kept value while a new subscription revalidates it. A returning route whose bound query still has a kept result renders it immediately as stale. Readers without data suspend until their active loader completes. Failed loaders also release execution; the route keeps its error visible and Retry starts a new load. Already mounted readers keep their data during refreshes.

`loadQuery` returns an idle query’s kept success immediately while it revalidates. A refresh of an already mounted query still waits for its fresh result. Typed failures are thrown directly, so the route can inspect `_tag` rather than an Effect fiber wrapper. Defects remain failed Promises. TanStack's loader `abortController` cancels the waiting subscription and rejects with `name: "AbortError"`; other readers of the same query can still complete. The application owns the registry's lifetime and disposes it when its client or session ends. Use the same registry for router context and `RegistryContext.Provider`.

#### Session permissions and guarded routes

Permissions come from the session payload's `user.permissions`, populated by `@shivaedev/access` through the server's role policy. `can(session, permission)` uses access's grant evaluator without making a request: names match exactly, and an `any` grant covers an `own` check for that name. An `own` grant does not cover an `any` check. `useCan()` supplies the same check from the nearest `PermissionBoundary` for component controls. A signed-out session has no grants. These checks control visibility; the server still authorizes every request.

Declare a route's requirement in TanStack's native `staticData`: `signedIn: true` admits any signed-in viewer, and `permission` requires a specific grant. Routes that declare neither stay public. Install `permissionGuard` once as the root route's `beforeLoad`; it checks all matched routes before their loaders run, including requirements on parents. Signed-out visitors go to the guard's `signedOut` redirect; pass it the router's `redirects.signedOut` so the guard and query routes share one target. A signed-in session without a required grant throws the shared `Forbidden` failure. A signed-in-only parent does not bypass a child's permission requirement.

Set `permissionGuard({ session, signedOut, hidden: true })` to hide refused routes from signed-in members. The guard throws TanStack's native not-found result, renders the app's `notFoundComponent` at the requested URL and prevents the route's loader from running. Signed-out visitors still go to sign-in with their return location; sessions with the required grant still enter the route.

```tsx
import { RegistryContext } from "@effect/atom-react";
import { createRootRouteWithContext, createRoute, createRouter, Link, useRouter } from "@tanstack/react-router";
import { RouterProvider } from "@shivaedev/react/adapters/routerProvider.ts";
import type { ReactNode } from "react";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { permission } from "@shivaedev/access/permission.ts";
import { Forbidden } from "@shivaedev/react/adapters/Forbidden.ts";
import { PermissionBoundary, PermissionBoundaryError, useCan } from "@shivaedev/react/adapters/permissionBoundary.ts";
import { permissionGuard } from "@shivaedev/react/adapters/permissionGuard.ts";
import type { QueryRouteRedirects } from "@shivaedev/react/adapters/queryRouteFailure.ts";
import { signInRedirect } from "@shivaedev/react/adapters/signInRedirect.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import { can } from "@shivaedev/react/can.ts";
import { queryRoute } from "@shivaedev/react/client/adapters/queryRoute.ts";
import { api, registry } from "./notes-client.ts";
import { auth, SignIn } from "./auth.tsx";
import { navigateTo } from "./adapters/navigateTo.ts";

const ReadNotes = permission("notes.read");
const root = createRootRouteWithContext<{
	registry: AtomRegistry.AtomRegistry;
	api: typeof api;
	redirects: Required<Pick<QueryRouteRedirects, "signedOut">>;
	session: PermissionSession | undefined;
}>()({
	beforeLoad: ({ context, ...route }) => permissionGuard({ session: () => context.session, signedOut: context.redirects.signedOut })(route),
});
const profile = createRoute({
	getParentRoute: () => root,
	path: "/profile",
	staticData: { signedIn: true },
	component: () => <h1>Profile</h1>,
});
const noteQuery = queryRoute(
	({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: Record<string, never> }) =>
		context.api.get.query({ id: params.id, page: 1 }),
);
const note = createRoute({
	getParentRoute: () => root,
	path: "/notes/$id",
	staticData: { permission: ReadNotes },
	...noteQuery,
	component: () => {
		const query = noteQuery.useQuery();
		return <h1>{query.data.title}</h1>;
	},
});
const login = createRoute({
	getParentRoute: () => root,
	path: "/login",
	validateSearch: (search: Record<string, unknown>) => ({
		returnTo: typeof search.returnTo === "string" ? search.returnTo : "/",
	}),
	component: () => {
		const { returnTo } = login.useSearch();
		return <SignIn onSignedIn={() => navigateTo(router, returnTo)} />;
	},
});
const router = createRouter({
	context: { registry, api, redirects: { signedOut: signInRedirect("/login") }, session: auth.session },
	InnerWrap: PermissionShell,
	defaultErrorComponent: PermissionBoundaryError,
	routeTree: root.addChildren([profile, note, login]),
	disableGlobalCatchBoundary: true,
});

function Controls() {
	const can = useCan();
	return can(ReadNotes) ? <button type="button">Read notes</button> : null;
}

function PermissionShell({ children }: { readonly children: ReactNode }) {
	const session = useRouter<typeof router>().options.context?.session;
	return (
		<PermissionBoundary session={session} fallback={<NoAccess />}>
			<Controls />
			{children}
		</PermissionBoundary>
	);
}

function NoAccess(): ReactNode {
	return (
		<>
			<Forbidden to="/profile" backLabel="Back to profile" />
			<Link to="/login">Use another account</Link>
		</>
	);
}

export function App({ session }: { readonly session: PermissionSession | undefined }) {
	return (
		<RegistryContext.Provider value={registry}>
			<RouterProvider router={router} context={{ session }} />
		</RegistryContext.Provider>
	);
}

const showNotes = can(auth.session, ReadNotes);
```

TanStack's `navigate` answers with a Promise, so the sign-in callback starts the navigation through a module in `adapters/`:

```ts
// adapters/navigateTo.ts
import type { AnyRouter } from "@tanstack/react-router";

export function navigateTo(router: AnyRouter, href: string): void {
	void router.navigate({ href });
}
```

`auth` owns the current session and passes it to `App`; `SignIn` updates that session before invoking `onSignedIn`. Use the session's registry for router context and React, as with other query routes. Importing `permissionGuard` augments TanStack's `StaticDataRouteOption`; route options and their inference remain native. The guard returns `void` explicitly, so `beforeLoad` needs no return annotation, including when it reads the session from route context.

`PermissionBoundary` runs the guards again when the grants of its `session` change without a navigation, such as a remembered session whose check answers with fewer grants, so a screen that needs a removed grant is replaced by the refusal. The application writes nothing for it; the boundary invalidates the router it renders inside.

`InnerWrap` puts `PermissionBoundary` inside the router, and the boundary's fallback can render `Link` and read route context. TanStack types `InnerWrap` as a component that returns an element, so `PermissionShell` leaves its return type to inference; annotated as returning `ReactNode`, it does not compile. Set `defaultErrorComponent: PermissionBoundaryError` so route and loader failures reach the boundary's fallback while TanStack keeps its navigation controller mounted. This lets a refused viewer follow the fallback link without reloading the page. Keep `disableGlobalCatchBoundary: true`; other errors propagate to an enclosing application boundary. A route-specific `errorComponent` owns any failures it consumes.

`Forbidden` from `@shivaedev/react/adapters/Forbidden.ts` supplies the no-access heading, explanation and a router link. Set `to` to a route the viewer may open. Optional `title`, `children`, `backLabel` and `className` let the application choose wording and layout. The default heading is “Permission denied” and the link says “Go back”.

`PermissionBoundary` also catches component query failures containing the shared `Forbidden` class. Without a boundary, query failures keep their normal typed state. TanStack resets route failures when the viewer navigates away; remount a boundary to clear a failure it catches outside the route error path.

#### Better Auth actions

`authAction` from `@shivaedev/react/client/authAction.ts` turns an input-to-Effect function into a native action atom. Bridge Better Auth with `authCall` from `@shivaedev/identity/client/adapters/authCall.ts`, then pass the atom to `useAction` for the same `pending`, `data`, `cause`, `result` and `dispatch` shape as commands:

```tsx
const signIn = authAction(authCall((credentials: { email: string; password: string }, signal) => authClient.signIn.email(credentials, { signal })));

function SignInButton({ email, password }: { email: string; password: string }) {
	const action = useAction(signIn);
	const failure = AsyncResult.error(action.result);
	return (
		<>
			<button disabled={action.pending} onClick={() => action.dispatch({ email, password })}>
				{action.pending ? "Signing in…" : "Sign in"}
			</button>
			{Option.isSome(failure) && <p role="alert">Sign-in failed</p>}
		</>
	);
}
```

The example uses `authAction`, identity's `authCall`, `useAction`, `effect/reactivity/AsyncResult` and `effect/Option`, with an application-owned `authClient`. Identity owns the Promise bridge and its typed failures; see [Better Auth client adapters](https://github.com/ShivaeDev/platform/blob/main/packages/identity/README.md#better-auth-client-adapters). For a form's Effect-based `onSubmit`, pass the function returned by `authCall` directly.

Use `authSession` from `@shivaedev/react/client/authSession.ts` to wrap identity's session Effect. It returns a native `atom` for `useQuery` and a `refresh` Effect that refreshes that same atom and waits through its loading state. Both expose typed `user.permissions` alongside the provider's existing session and user fields, using the `PermissionSession` schema from `@shivaedev/identity/PermissionSession.ts`. Applications do not decode `get-session` themselves. Missing grants stay optional; malformed grants fail with `AuthUnavailable`. The reader must return a nullable session with a `user` object; use `authQuery` for other payload shapes. Pass `{ remember: browserSessionMemory }` as the second argument to start a returning person's app from the last verified session while the check runs; see [identity's remembered session](https://github.com/ShivaeDev/platform/blob/main/packages/identity/README.md#start-from-the-last-verified-session) for what it keeps and what it means. With `remember`, the session also has `signOut(request)`, which wipes the memory when the sign-out request succeeds. Supply Better Auth's public `getSession` call with `disableCookieCache: true` so a mutation reads current user data:

```tsx
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { authCall } from "@shivaedev/identity/client/adapters/authCall.ts";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { authSession } from "@shivaedev/react/client/authSession.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";

const session = authSession(readSession((signal) => authClient.getSession({ query: { disableCookieCache: true }, fetchOptions: { signal } })));
const updateUser = authCall((name: string, signal) => authClient.updateUser({ name }, { signal }));
const rename = Atom.fn<string>()((name) => updateUser(name).pipe(Effect.andThen(session.refresh)));

function Account() {
	const query = useQuery(session.atom);
	const action = useAction(rename);
	return (
		<section aria-busy={query.pending}>
			{Option.isSome(query.data) && <p>{query.data.value?.user.name ?? "Signed out"}</p>}
			<button disabled={action.pending} onClick={() => action.dispatch("Alicia")}>
				{action.pending ? "Saving…" : "Change name"}
			</button>
		</section>
	);
}
```

The example uses `Option` from `effect` and the application's Better Auth client. The mutation stays pending until the refreshed session settles; the query retains its previous data while refreshing and exposes `pending` for `aria-busy`. Compose email verification with `session.refresh` the same way. Reads preserve returned auth errors and use `AuthUnavailable` from `@shivaedev/errors/taxonomy.ts` for rejected promises; a failed refresh fails the composed mutation. A successful `null` session represents sign-out.

`session.refresh` uses the native `AtomRegistry` service supplied by action atoms and atom runtimes. For an Effect run outside an atom, provide the registry that renders the session with `Effect.provideService(AtomRegistry.AtomRegistry, registry)`. Keep the session atom in the auth owner's registry, above any session boundary whose subtree it replaces. The application owns when to refresh; the session atom does not subscribe to Better Auth's hook or store.

For other Better Auth reads, `authQuery` from `@shivaedev/react/client/authQuery.ts` creates an input-keyed query atom family. Pass an input-to-Effect function, such as the result of `authQuery` from `@shivaedev/identity/client/adapters/authQuery.ts`, then render its atom with `useQuery`. Releasing a pending read interrupts its Effect and aborts the supplied signal.

Pass the auth owner’s sign-out atom to `SessionBoundary` as `signOut={signOut}` and dispatch it with `useSignOut` below. The boundary mounts it in the auth owner’s registry and unmounts the signed-in tree while sign-out is pending, including the following session refetch. A successful action keeps the tree held until the session clears; a failed action releases the hold. Supply an atom for the sign-out request itself, and give `recheck` the auth owner’s session refresh. After the request succeeds, the boundary starts that check and retries failures while holding the tree. A failed session check never releases a successful sign-out’s hold.

For an explicit sign-out in a TanStack route, use `useSignOut(signOut, { signIn: "/sign-in" })` from `@shivaedev/react/client/adapters/useSignOut.ts` in place of `useAction`. It exposes the same state and a `dispatch()` handler. The hook records sign-out intent before the request and navigates to sign-in after success. A refused request clears that intent, including when the boundary remounts its route. Repeated clicks while pending share one request and follow-up. Unmounting the component or disposing its registry stops the follow-up navigation. If a session refresh replaces the component before the response, the replacement session’s route policy owns navigation to sign-in. `signInRedirect` and `signInSearch(location)` omit `returnTo` for that intent, including when the auth owner's session refresh reruns guards first. Use `signInSearch` for module sign-in links too; ordinary visits retain the full requested location. Applications do not need history markers or Better Auth completion timing hooks.

### 3. Every day

These rules apply to each component and test you write.

#### Hook configuration between renders

`useCreate` and `useEditor` call the latest committed render's operation `run` with that render's `fixed` values. Both hooks use the latest `failures` handlers when a save fails, including when a handler is removed to restore the default field mapping. An inline `run` or callback may close over changing props or state without replacing the form or losing edits.

Changing the `fields` schema or the operation's `runtime` replaces either hook's form and discards its in-memory draft and submission state. A changed editor `query` also starts a new form. Keep schemas, runtimes and query atoms outside components or memoize them; constructing a schema on every render continually replaces the form.

`useEditor`, `useCreate` and the lower-level `submission` accept form’s `requiredMessages`, `checks`, `debounce` and `arrayKeys`. Required wording and checks use encoded field names and values; check services come from the operation's runtime, and array key selectors receive encoded elements. Form owns check scheduling, stale feedback and keyed rejection tracking.

`initialValues` (create), `values` (editor), `persistedDraft`, `requiredMessages`, `checks`, `debounce` and `arrayKeys` are setup options, captured when the hook first creates a form and again when its fields, `runtime` or editor `query` changes. Successful creates reuse the captured setup options for the next entry. Changing setup options alone does not replace an existing form; remount the component with a different React `key` to apply them. An editor's `loaded` value remains a fallback for query data, as with `useLoaderQuery`.

#### Resume and refresh policy

Keep the signal and query identities stable:

```ts
import { resumeSignal } from "@shivaedev/contract/resume.ts";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

const resume = resumeSignal({ window });
const query = Atom.makeRefreshOnSignal(resume)(Atom.make(Effect.succeed("ready")));
```

`resumeSignal` changes on visible `visibilitychange`, `online` and `pageshow` events. Hidden browser events do not refresh the query. An optional `native` source subscribes a callback and returns its unsubscribe function; its callback also changes the signal. Registry disposal removes the listeners. This module uses the shared [contract resume implementation](https://github.com/ShivaeDev/platform/blob/main/packages/contract/src/resume.ts).

Use native stale-while-revalidate policy when a resume should refresh only stale data:

```ts
const query = Atom.swr(atom, {
	focusSignal: resume,
	revalidateOnFocus: true,
	staleTime: "1 hour",
});
```

`atom` is the underlying native query. `Atom.swr` owns the staleness decision; the signal only reports that the application resumed.

#### Read the current time

`useNow(interval, runtime?)` from `@shivaedev/react/client/useNow.ts` returns epoch milliseconds from Effect's `Clock` and re-renders at the given interval in milliseconds. Pass the component's atom runtime to use its clock:

```ts
import { useNow } from "@shivaedev/react/client/useNow.ts";

const now = useNow(60_000, client.runtime);
const minutesAgo = Math.floor((now - savedAt) / 60_000);
```

Without a runtime it uses a native empty atom runtime. Stories supply a runtime with their TestClock service so advancing that clock updates the rendered time.

#### Debounce and delay on the runtime clock

`useDebouncedValue(value, duration, runtime?)` from `@shivaedev/react/client/useDebouncedValue.ts` returns the initial value immediately, then retains the previous value until input stops changing for the duration. A changed value or duration restarts the pending window. The timer runs on the atom runtime's Effect `Clock`, and its observed native `AsyncResult` stays waiting throughout that window, so `screenPending()` includes it when settling a story.

```tsx
import { useDebouncedValue } from "@shivaedev/react/client/useDebouncedValue.ts";
import { useDelay } from "@shivaedev/react/client/useDelay.ts";

const query = useDebouncedValue(search, "300 millis", client.runtime);
const press = useDelay("450 millis", client.runtime);

<button
	onPointerDown={() => press.start(() => selectRow(id))}
	onPointerUp={press.cancel}
	onPointerLeave={press.cancel}
	onPointerCancel={press.cancel}
>
	Select row
</button>;
```

`useDelay(duration, runtime?)` schedules one callback with `start(callback)` and exposes `pending` and `cancel()`. Starting again replaces the pending callback. Changing the duration cancels it. Unmounting cancels both hooks' timers. Without a runtime, each hook uses a native empty atom runtime with Effect's default Clock. Pass the application's runtime so stories can control the same clock, and cancel a long press on the pointer events appropriate for the application's interaction.

In a story kit, acquire `watchedClock` from `@shivaedev/test-story/server/watchedClock.ts` and pass it both to the atom runtime's Clock Layer and the screen driver's `clock` option. With `pending: screenPending()` for that registry and React's `act`, typing followed by `settle()` advances registered sleeps inside `act` until the debounce and resulting work finish. Kit verbs need no debounce duration. To check a long-press boundary explicitly, run that clock's `adjust(duration)` inside `act` in a verb that accepts the elapsed duration.

#### Ids, time and promises in callbacks

`useNewId(runtime?)` from `@shivaedev/react/client/adapters/useNewId.ts` returns a UUIDv4 generator. `useClock(runtime?)` from `@shivaedev/react/client/adapters/useClock.ts` returns a `now()` callback that reads epoch milliseconds when called. Both read services from the supplied atom runtime in the current registry and can be used in state initializers and event handlers:

```tsx
import { useState } from "react";
import { useClock } from "@shivaedev/react/client/adapters/useClock.ts";
import { useNewId } from "@shivaedev/react/client/adapters/useNewId.ts";

const newId = useNewId(client.runtime);
const now = useClock(client.runtime);
const [id] = useState(newId);
const [createdAt] = useState(now);
const stamp = () => ({ id: newId(), at: now() });
```

These lines belong inside a component; `client` is the application's atom client. Stories pass a runtime containing their test Clock and seeded `SecureRandom`. The hooks use native atom suspense while the runtime builds. `useNewId` reads `SecureRandom` from `effect/crypto`, whose UUID generation must be synchronous. Without a runtime, they use a shared native runtime with Effect's default Clock and `clientCrypto` from `@shivaedev/react/client/adapters/crypto.ts`, which merges Effect's Web Crypto `SecureRandom` and `Digest` Layers. Provide that Layer to an application's runtime when it needs browser crypto.

`usePromiseAction(() => promise, options?)` from `@shivaedev/react/client/adapters/usePromiseAction.ts` returns the same state as `useAction`, with `dispatch()` taking no input. It runs the callback on dispatch, keeps its atom across rerenders and calls the latest committed callback. A promise rejection or synchronous throw becomes `Cause.UnknownError` by default. Supply `catch` to map the unknown cause into an application's typed failure:

```tsx
import { usePromiseAction } from "@shivaedev/react/client/adapters/usePromiseAction.ts";

const copy = usePromiseAction(() => navigator.clipboard.writeText(text), {
	catch: (cause) => new ClipboardDenied({ reason: String(cause) }),
});
const button = (
	<button disabled={copy.pending} onClick={() => copy.dispatch()}>
		Copy
	</button>
);
```

These lines belong inside a component; `text` and `ClipboardDenied` belong to the application. Read the success from `copy.data` and the typed failure from `copy.cause` or `copy.result`. The helper runs through a native action atom and adds no promise cancellation adapter.

#### Render tests in happy-dom

Use `@shivaedev/test-story/client/adapters/react.ts` with Vitest's `happy-dom` environment. Install changes, contract and identity for the module's keys, operations, middleware and client binding, and the testing peers and environment in your app's dev dependencies:

```sh
pnpm add @shivaedev/changes @shivaedev/contract @shivaedev/identity
pnpm add -D @shivaedev/test-story @effect/platform-node @effect/vitest vitest happy-dom react-dom @types/react-dom
```

Configure Vitest with `test: { environment: "happy-dom" }`, or select that environment for your DOM test project. The screen below reads a defined `notes` module, whose operations yield a `NoteTitles` service and run behind identity's `Authenticated` middleware:

```ts
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { notesWire } from "#generated/modules/notes/Notes.ts";
import { NoteTitle, notes } from "#modules/notes/model.ts";
import { NoteTitles } from "#modules/notes/services.ts";

const List = query("list", {
	reads: () => [notes.list],
	*run() {
		return yield* (yield* NoteTitles).all;
	},
});
const Add = command("add", {
	invalidates: () => [notes.list],
	payload: NoteTitle,
	*run({ title }) {
		yield* (yield* NoteTitles).add(title);
	},
});
export const Notes = defineModule({ middleware: Authenticated, name: "notes", operations: [List, Add], wire: notesWire });
```

`model.ts` declares `notes` as `collection("notes", Schema.Number)` and `NoteTitle` as `Schema.Struct({ title: Schema.String })`, and `services.ts` declares `NoteTitles` with an `all` Effect of titles and an `add(title)` method. Keep the engine, rendering and verbs in a story kit under `src/test-support/notesScreen.tsx`. This kit serves the module's own handlers from `moduleHandlers` over native RPC, with an in-memory `NoteTitles` and a fake `Authenticated` that signs alice in, binds the generated contract and gives the screen driver the registry's pending signal:

```tsx
import { Effect, Layer, Option, Ref } from "effect";
import { act, createElement } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { screenPending } from "@shivaedev/react/adapters/screenPending.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { Notes as NotesModule } from "#modules/notes/Notes.ts";
import { NoteTitles } from "#modules/notes/services.ts";

export const notesScreen = storyKit({
	*create() {
		const stored = yield* Ref.make<readonly string[]>([]);
		const titles = Layer.succeed(NoteTitles, {
			add: (title) => Ref.update(stored, (all) => [...all, title]),
			all: Ref.get(stored),
		});
		const signedIn = Layer.succeed(Authenticated, (effect) =>
			effect.pipe(Effect.provideService(CurrentViewer, Option.some({ id: "alice" })), Effect.provideService(Identity, { id: "alice" })),
		);
		const handlers = moduleHandlers(NotesModule).pipe(Layer.provide(titles));
		const { api } = makeClient(Notes, {
			live: false,
			protocol: layerMemoryProtocol(NotesModule.application).pipe(Layer.provide([handlers, signedIn])),
			url: "memory://notes",
		});
		function NotesView() {
			const list = useQuery(api.list.query());
			const add = useAction(api.add);
			return createElement(
				"section",
				null,
				createElement("output", null, Option.getOrElse(list.data, () => []).join(", ")),
				createElement(
					"button",
					{
						disabled: list.pending || add.pending,
						onClick: () => add.dispatch({ title: "Morning walk" }),
						type: "button",
					},
					"Add",
				),
			);
		}
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement(NotesView))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { pending, view };
	},
	inspect: ({ view }) => ({ screen: view.container.textContent }),
	name: "notes screen",
	stages: ["screen"],
	verbs: ({ pending, view }, story) =>
		screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending,
			root: view.container,
			tell: story.tell,
		}),
});
```

The spec drives one action and states what the screen shows. With `#test/*` mapped to `src/test-support/*` in your package's imports, `notesScreen.dom.spec.tsx` is:

```tsx
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { notesScreen } from "#test/notesScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

notesScreen.it("a command refetches the rendered notes through native RPC", [], function* ({ click, settle, text }) {
	yield* settle();
	expect(text("output")).toBe("");

	yield* click({ name: "Add", role: "button" });
	yield* settle();

	expect(text("output")).toBe("Morning walk");
});
```

`settle()` waits for the engine's pending work and flushes the resulting React render. Release held server responses with a Deferred or another engine completion signal, then settle the screen before reading it. Keep each verb to one action and let a missing target fail; the driver's `click` and `enter` require a rendered control. Keep expectations in the spec.

`render(node, options?)` returns the attached `container`, its fresh native `registry`, `render(nextNode)` to update the same root and registry, and `unmount()` to release the root, registry and container. The options are React's own `RootOptions`, passed to `createRoot`, including `onCaughtError`, `onUncaughtError` and `onRecoverableError`. Acquire the view with `Effect.acquireRelease` so its scope releases it on success, failure or interruption. The screen driver's `act` adapter keeps component interactions and settling inside React's `act`. `expectNoReactWarnings()` registers a Vitest hook that fails a test if it logged to `console.error`.

The kit runs the module's real operations, read policies included, and replaces only the service they yield and the session. `moduleHandlers` requires exactly the services the operations yield beyond the middleware, so the compiler names one the kit forgets. The fake middleware provides the viewer the default `signedIn` policy checks and the `Identity` the operations may yield; without a viewer, the list answers `QueryReadDenied`. The starter's [notes screen kit](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/test-support/client.ts) fakes its middleware the same way. A story about persistence or the real session runs the operations through the application host, as the starter's application kit does.

For a boundary fallback test, keep the warnings guard and declare the caught error inside the test. `expectCaughtError(predicate)` returns an `onCaughtError` handler that accepts matching errors without logging them. The guard fails if the handler receives any other error or the expected error never arrives. Other console errors and React warnings still fail the guard.

```tsx
const warnings = expectNoReactWarnings();

screenStories.it("shows the route failure", [], async () => {
	const onCaughtError = warnings.expectCaughtError((error) => error instanceof RouteFailure);
	const view = await render(<RouteFailureScreen />, { onCaughtError });
	try {
		expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Route unavailable");
	} finally {
		await view.unmount();
	}
});
```

Story kits can acquire `captureReactWarnings` from `@shivaedev/test-story/client/adapters/react.ts` in their `create` effect with `const warnings = yield* captureReactWarnings`. The scope owns the capture and restores `console.error` when it closes, including after a failed story. Pass `warnings.onCaughtError` to `render` to capture boundary errors, or `warnings.expectCaughtError(predicate)` to exclude a declared error. Both handlers silence caught errors; the capture also silences and records `console.error` calls. `warnings.read()` returns `{ consoleErrors, caughtErrors }`, with each console call's arguments and the unexpected caught errors. It asserts nothing, leaving the story spec to state its expectation. The Vitest guard uses the same capture mechanism and additionally checks that every declared error occurred.

A screen kit tells its screen driver when the screen has finished its work with `screenPending({ router })` from `@shivaedev/react/adapters/screenPending.ts`. The Effect reads the `AtomRegistry` from its environment and returns a function that reports `true` while a native `AsyncResult` that something still reads is waiting, or while the optional TanStack router loads a route, and `false` otherwise. A result left waiting by a component that has unmounted does not count, even while the registry's idle window keeps its atom. A mounted live query counts until its first answer arrives; after that its open subscription keeps nothing pending, so the screen settles while the live query stays mounted. Each call reads the registry and router at that moment, so pass it as the driver's `pending` option instead of listing the screen's queries by hand:

```ts
const pending = yield* screenPending({ router }).pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
const screen = screenDriver({ act, pending, root: view.container, tell: story.tell });
```

### API

`useQuery(atom)` and `useAction(atom)` return these shared fields:

| Field        | Meaning                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `result`     | Native `AsyncResult<A, E>`.                                                                                                     |
| `data`       | `Option<A>` from the current or retained success. Queries can retain displayed data even when the native `result` has no value. |
| `cause`      | `Option<Cause<E>>` from a failed result.                                                                                        |
| `pending`    | The native result is waiting.                                                                                                   |
| `refreshing` | The result is waiting and successful data is available.                                                                         |

`useQuery(atom, options?)` adds `refresh(): void`; `useAction` adds `dispatch(input): void`. `QueryOptions.notice` publishes a notice descriptor for a failed result. `QueryOptions.keepPreviousData` defaults to `false` and controls retention across query atom changes. Same-identity refresh retention is always enabled. `result` and `cause` describe the current native query even when `data` displays a previous atom's success. Success, input and typed failure types are inferred from the supplied atom. `useAction(atom)` takes a native action atom and publishes nothing; its failures stay in `cause`. `useAction(operation, options)` takes a bound command or `{ run, runtime }`, and its options supply `concurrent`, `notices.onSuccess`, `failures`, `silent`, `onSuccess(value, input)` and `onFailure(error, input)`; the options may be left out when the operation has no rejection of the app's own. Its shared state also includes the runtime's typed failure.

Import the defining `.ts` module, such as `@shivaedev/react/client/editor.ts`. There is no root import. `useSessionRecheck()` from `client/sessionBoundary.ts` requests the boundary’s shared session check.

Prefer `useEditor` and `useCreate` when binding a form to a command. The lower-level modules expose the same composition pieces: `submission` from `submission.ts` makes a form and its submission snapshot reader, `rejecting` from `@shivaedev/form/fieldRejection.ts` maps save failures through a submitter, and `useSaveState` from `client/saveState.ts` observes submission and invokes a success callback. `FieldRejection`, `RejectField` and `fieldRejectionOf` also belong to `@shivaedev/form/fieldRejection.ts`; `AtomServices` belongs to `AtomServices.ts`.

### Install, setup and limits

```sh
pnpm add @shivaedev/react @effect/atom-react effect react
```

`@shivaedev/form` and `@shivaedev/contract` install with the package as dependencies. Add form directly when the application imports its modules, such as `useField` for editor inputs:

```sh
pnpm add @shivaedev/form
```

Add the optional router peer when using `queryRoute`, `loadQuery`, `permissionGuard`, `signInRedirect`, `PermissionBoundary`, `PermissionBoundaryError`, `Forbidden` or `useSignOut`:

```sh
pnpm add @tanstack/react-router
```

The package needs Node 24 or newer.

- Query identity, TTL, invalidation and action concurrency remain native atom policies. Put the registry at the lifetime boundary those policies need.
- The package has no SSR registry/hydration adapter, offline write queue or optimistic reconciliation policy.

## Browser errors

Mount `useBrowserErrors` from `@shivaedev/react/client/adapters/useBrowserErrors.ts` once in the root component, outside the signed-in subtree. It forwards uncaught window errors and unhandled promise rejections to `appHost`'s `POST /_platform/errors` route, using the current page URL and available message and stack. Unmounting removes both listeners. Failed reporting requests are discarded. The starter mounts it by default.

The server rate-limits and redacts browser reports before sending them to Railway tracing alongside server errors and traces. Browser code receives no exporter credentials. See the [server guide](https://github.com/ShivaeDev/platform/blob/main/packages/server/README.md) for the route and local trace setup.
