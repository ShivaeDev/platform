# @shivaedev/react

React screens should not rebuild loading, refresh, save and session rules around every native Effect atom. This package gives queries and actions readable state, joins a record to its editable form, and keeps each session's client state together.

## Why you want this

A refresh should not blank a useful screen. A save response should not erase what someone typed while waiting. Signing in as someone else should not inherit the previous person's draft. These hooks and the session boundary handle those transitions around native atoms and forms:

```ts
const editor = useEditor({
  query: api.get.query({ id }),
  fields: InvoiceLineFields,
  values: (line) => ({ name: line.name, quantity: String(line.quantity) }),
  save: (values) => api.save.run({ id, ...values }),
  runtime: InvoiceLinesClient.runtime,
});
```

`api` is the application's native RPC binding, and `InvoiceLineFields` describes its inputs. The editor creates the form when the row arrives. A refresh updates untouched fields and keeps edited ones; a save receives the server's normalized result while keeping edits made during the request. The component renders the form and decides what its loading and error messages say.

## Using it

### How to think about it

State belongs to an **atom in a registry**. A query hook reads that atom's native `AsyncResult`; an action hook reads and dispatches a native action atom. Two readers of the same query share its execution. Changing the query atom resets displayed data by default. An application can use `useQuery(atom, { keepPreviousData: true })` to keep the last successful value while a changed payload loads or fails. This retained display belongs to the hook and clears when its registry changes; native atoms still own execution and caching. Editors keep the default reset so a new record starts a new form.

`useQuery` and `useAction` turn native results into `data`, `cause`, `pending` and `refreshing`. A query's same-identity refresh always keeps the last successful value, including after a typed failure, so a component can show data and an error together. An action uses the native result's retained success. Keep the atom's identity stable for the same work: declare it outside render or use the native family's identity, such as `AtomRpc.Service.query(...)`.

An **editor** joins a query atom, an form field schema and a save Effect. The query provides the row; `values(row)` converts it to input values; the schema decodes those values before the save runs. form owns the draft and the per-field merge. A **create form** uses the same submission rules without a query and starts a fresh form after success.

A **session generation** is the string returned by `identify(session)`. `SessionBoundary` owns its client, registry and React subtree. Your auth owner supplies the session and decides when to replace or end it. The boundary automatically mounts live connections on bound contract APIs returned by `connect`, directly or as client properties such as `api`. Use a Platform database host and NDJSON transport; the application needs no subscribe handler or `live()` call. Live changed hints coalesce over 20 ms by default. Set `liveCoalesceWindow` on `SessionBoundary` to a native Duration to choose the window for that session, or `0` for immediate per-hint refreshes. A bound query can override that default with `useQuery(atom, { coalesceWindow: "2 seconds" })`. Changing this option applies to subsequent windows without reconnecting or refetching any query; a window already started keeps its deadline. A refetch in flight runs once more after settling when further hints arrive. Cache policy, RPC declarations and transport stay with native Effect and the application; this package supplies their React state and lifecycle boundary.

`useEditor` and `useCreate` opt into persisted input with `persistedDraft: { key }`. Choose a stable key for the record or create request, independent of its server revision. The adapters use form's browser storage and inherit ownership from `SessionBoundary`: reload and query refresh preserve edits, successful submission clears accepted input, and a committed session replacement drops tracked drafts. A suspended replacement that is canceled keeps the visible session's draft and future writes. Later edits made during a save remain persisted. Optional `storage`, `maxBytes` and `maxAgeMs` customize the provider and bounds; defaults are `localStorage`, 256 KiB of UTF-8 JSON and seven days. See [form's persisted input API](https://github.com/ShivaeDev/platform/tree/main/packages/form#persist-input-across-reloads) for direct form hooks and limits.

### 1. Once per application: own the registry

For a screen without a session boundary, wrap it in the native provider:

```tsx
import { RegistryProvider } from "@effect/atom-react";

export function App() {
  return <RegistryProvider><Orders /></RegistryProvider>;
}
```

`Orders` is the application's feature component. For authenticated screens, use `SessionBoundary` at the authenticated root instead:

```tsx
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import { makeOrderClient, OrderScreens } from "./orders.tsx";

interface Session {
  readonly id: string;
  readonly credentialGeneration: number;
  readonly token: string;
}

export function App({ session, recheck }: {
  readonly session: Session | undefined;
  readonly recheck: () => void;
}) {
  return (
    <SessionBoundary
      session={session}
      identify={(current) => `${current.id}:${current.credentialGeneration}`}
      connect={(current) => makeOrderClient(current.token)}
      recheck={recheck}
      signedOut={<p>Signed out</p>}
    >
      {(client) => <OrderScreens client={client} />}
    </SessionBoundary>
  );
}
```

`makeOrderClient` and `OrderScreens` belong to the application. A changed generation creates a new client and registry, remounts the screens and disposes the outgoing registry. `undefined` renders `signedOut`. Updating the session object with the same generation keeps the existing client: `connect` does not receive a rotated token until the identity changes. Include the credential generation when the client captures its token, as above.

For a native shell, pass its resume source when binding the API returned by `connect`:

```ts
import { bind } from "@shivaedev/contract/bind.ts";
import type { ResumeSource } from "@shivaedev/react/resumeSignal.ts";
import { onAppResume, onNetworkReturn } from "./native-lifecycle.ts";

const resume: ResumeSource = (notify) => {
  const stopApp = onAppResume(notify);
  const stopNetwork = onNetworkReturn(notify);
  return () => { stopApp(); stopNetwork(); };
};
const connect = () => bind(Notes, Client, { resume });
```

`Notes` and `Client` are the application's contract and native AtomRpc client. The application implements `onAppResume` and `onNetworkReturn`, each returning its unsubscribe function. `SessionBoundary` mounts the bound connection, and native notifications reopen the subscription and reconcile its tracked queries alongside the browser visibility and online defaults. Disposing the session's registry releases the native listeners. Omitting `resume` keeps the browser defaults.

A query that fails with a tagged `Unauthorized` asks `recheck` to run and keeps its retained data. An action does the same once per failed result, retaining its last successful `data` and the typed failure in `cause`; rerendering that result does not repeat the recheck. The auth owner can retry the same session or remove it; the hook does not sign the user out. The boundary also handles React StrictMode's effect replay and preserves component state across hiding and revealing an `<Activity>` subtree, supplying a live registry when revealed.

### Migrate a self-only feature to session keys

Before migration, an owner field exists only to give client reads and invalidations a key. The server already chooses the account from `Identity`:

```ts
const preferences = collection("preferences", Schema.String);
const Preferences = contract("preferences", {
  queries: [query("self", {
    payload: { ownerId: Schema.String },
    reads: ({ ownerId }) => [preferences.item(ownerId)],
    success: Schema.String,
  })],
  commands: [command("save", {
    payload: { ownerId: Schema.String, title: Schema.String },
    invalidates: ({ ownerId }) => [preferences.item(ownerId)],
    success: Schema.String,
  })],
}).middleware(Authenticated);

const api = bind(Preferences, Client);
const self = api.self.query({ ownerId: session.userId });
const save = api.save.run({ ownerId: session.userId, title: "My preferences" });
```

After migration, remove `ownerId` from both payload schemas and every call site. Add `keyScope: "session"` and keep a logical item key for the self-only record:

```ts
const preferences = collection("preferences", Schema.String);
const Preferences = contract("preferences", {
  keyScope: "session",
  queries: [query("self", {
    reads: () => [preferences.item("self")],
    success: Schema.String,
  })],
  commands: [command("save", {
    payload: { title: Schema.String },
    invalidates: () => [preferences.item("self")],
    success: Schema.String,
  })],
}).middleware(Authenticated);

const api = bind(Preferences, Client, { registry });
const self = api.self.query(undefined);
const save = api.save.run({ title: "My preferences" });
```

The examples use `Schema` and `Effect` from `effect`, `contract`, `query`, `command`, `collection` and `bind` from contract's defining modules, and `Authenticated` from `@shivaedev/identity/middleware.ts`. `Client` is the application's native AtomRpc service. In React, obtain `registry` from the second argument to `SessionBoundary.connect`:

```tsx
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";

<SessionBoundary
  session={session}
  identify={(current) => current.generation}
  connect={(current, registry) => bind(Preferences, makePreferencesClient(current.token), { registry })}
  recheck={recheck}
  signedOut={<p>Signed out</p>}
>
  {(api) => <PreferencesScreen api={api} />}
</SessionBoundary>
```

`makePreferencesClient(token)` creates the application's native AtomRpc service and configures its transport credentials. Existing one-argument `connect` callbacks continue to work. The boundary allocates the registry before calling `connect`; an unchanged generation keeps its binding and state. Account replacement, sign-out and same-account re-entry dispose the old registry, private query tracking, live registrations and pending refreshes. Choose a generation that changes whenever the auth owner starts a new session.

Handlers continue reading the account from request-local `Identity`, imported from `@shivaedev/identity/identity.ts`, before and after migration:

```ts
Preferences.application.toLayer({
  "preferences.self": () => Effect.flatMap(Identity, ({ id }) => store.read(id)),
  "preferences.save": ({ title }) => Effect.flatMap(Identity, ({ id }) => store.save(id, title)),
});
```

`store` is the application's persistence service. No owner or client key scope is accepted from a request. The database app host of `@shivaedev/server` resolves the server key scope from that same request-local identity. `List` and `Item` remain the key shapes; scope is an additional dimension, and the client registry's opaque scope is never sent as an owner id.

### Trace an action across RPCs

Editor saves and create submissions automatically run their save Effect in a fresh `ui.submit` trace. For custom actions, wrap the Effect that performs the action with `actionTrace` before giving it to a native atom:

```ts
import { Effect } from "effect";
import { actionTrace } from "@shivaedev/react/actionTrace.ts";

const save = OrdersClient.runtime.fn((input: OrderInput) =>
  actionTrace(Effect.gen(function* () {
    yield* api.validate.run(input);
    return yield* api.save.run(input);
  }), "ui.saveOrder"),
);
```

`OrdersClient`, `OrderInput` and `api` belong to the application. Dispatch `save` with `useAction(save)`. `actionTrace(effect, name?)` preserves the Effect's result, typed error and service requirements; its default span name is `ui.action`. Each execution starts a fresh trace, and RPCs run inside that Effect share it, including across asynchronous boundaries. Native atoms continue to own execution and cancellation. `useAction` also accepts ordinary native action atoms; wrap composite action Effects to group their RPCs.

Use native `RpcClient.layerProtocolHttp` with `FetchHttpClient.layer` for the browser RPC protocol. Effect sends the trace in the W3C `traceparent` HTTP header. The `appHost` of `@shivaedev/server` carries it into the RPC span and its SQL, and annotates the RPC span with `request.id`. Enqueued pg-boss jobs retain that span context; worker attempts start separate traces linked back to the sender.

### One supported path for query, command and form feedback

Use `useQuery` with `QueryView` for reads, the Effect overload of `useAction` for commands, and `useCreate` or `useEditor` for form submissions. Give these owners notice descriptors and mount one `NoticeHost` inside the session boundary. contract still runs commands and invalidates queries; form still owns submission, fields and drafts. The app supplies wording, Undo payloads and expected versions.

Mount the optional `NoticeHost` from `@shivaedev/react/notices.ts` inside `SessionBoundary`, above the screens. The host owns a native atom collection, dismissal, expiry and each notice action's native `AsyncResult`. Supply `render(notice)` to choose markup, wording for action outcomes and labels. Render `notice.action.run` as a button handler and disable that control with `notice.action.pending`; `notice.dismiss` removes the entry. No command requires a host.

```tsx
import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { NoticeHost, type Notice } from "@shivaedev/react/notices.ts";

function renderNotice(notice: Notice) {
  const action = notice.action;
  return <article role="status">
    <p>{notice.message}</p>
    {action && <button disabled={action.pending} onClick={action.run}>{action.label}</button>}
    {action && AsyncResult.isSuccess(action.result) && <p>Undo completed</p>}
    {action && AsyncResult.isFailure(action.result) && <p>{Cause.pretty(action.result.cause)}</p>}
    <button onClick={notice.dismiss}>Dismiss</button>
  </article>;
}

function SessionScreens({ client }: { readonly client: AppClient }) {
  return <NoticeHost render={renderNotice}><OrderScreens client={client} /></NoticeHost>;
}
```

`AppClient` and `OrderScreens` belong to the application; return `SessionScreens` from the session boundary's child function. The renderer receives `id`, `message`, `dismiss` and an optional action with `label`, `run`, `pending` and `result`. Action results retain the native success value or failure cause as `unknown`; narrow domain errors in your renderer to choose their wording.

The Effect overload of `useAction` accepts `notices.onSuccess(value, input)` and `notices.onFailure(error, input)`. Each callback returns a descriptor or `undefined`. Independent concurrent completions publish independently, preserving the invocation's input. `useCreate` and `useEditor` accept the same `notices` option around their existing save Effects. Use the descriptors instead of screen-local notice state, expiry timers or result-watching effects:

```ts
const remove = useAction(OrdersClient.runtime, api.remove.run, {
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
    onFailure: () => ({ message: "Could not remove this order" }),
  },
});
```

`OrdersClient`, `api`, the restore payload and its expected version belong to the application. The host runs the supplied Effect with the operation's native runtime, disables repeated dispatch while it is pending and exposes the outcome on that action. A failed Undo stays on its original notice; it does not become another operation failure notice. Command execution and invalidation remain with contract, and form submission remains with form.

For query failures, pass `useQuery(atom, { notice: ({ cause, refreshing }) => descriptor })`. `useEditor` accepts the same callback as `queryNotice` for its query. `refreshing` distinguishes a failure with retained data from an initial load failure. Each settled failed result publishes once per hook; a rerender does not replay it. Omit the callback or return `undefined` for operations that need no notice.

The query and form in the same feature use their own feedback options:

```tsx
const notes = useQuery(api.list.query(), {
  notice: ({ refreshing }) => ({
    message: refreshing ? "Refresh failed" : "Load failed",
  }),
});
const save = useCreate({
  fields: TitleFields,
  initialValues: { title: "" },
  create: api.save.run,
  runtime: NotesClient.runtime,
  notices: { onSuccess: (title) => ({ message: `Saved ${title}` }) },
});
```

Here `api`, `NotesClient` and `TitleFields` belong to the app. Render `notes` through `QueryView`: its loading renderer shows pending work, its failure renderer offers `notes.refresh` as Retry, and its content renderer holds the form and command controls. Bind fields with form's `useField`, submit with `save.save()` and disable Save with `save.saving`. A tagged field rejection stays beside that input. A held save keeps newer edits when it completes and publishes its success notice before the invalidated query finishes. A failed refresh keeps the last content and the draft while publishing the refresh notice.

The [notes feature](https://github.com/ShivaeDev/platform/tree/main/packages/react/src/test-support/feedback-path) composes these owners with the existing in-memory RPC fixture. Its [feedback stories](https://github.com/ShivaeDev/platform/blob/main/packages/react/src/feedbackPath.dom.spec.tsx) cover loading and retry, rejected fields, a held save, concurrent command notices, Undo and its version conflict, and retained content after a refresh failure. The [session story](https://github.com/ShivaeDev/platform/blob/main/packages/react/src/feedbackSession.dom.spec.tsx) replaces a session during a command and Undo: the outgoing registry is disposed, late completion callbacks and outcomes do not publish, and retained notice action and dismiss handlers cannot change the new host. These are React render stories over test RPC handlers, not evidence of a deployed service.

A descriptor has `message`, optional `expiresIn` as a native Duration, and optional `action: { label, run }`. Without an expiry it remains until dismissed or the host ends. Dismissal, expiry, host unmount and session replacement remove entries, clear expiry timers and interrupt pending actions. Native uninterruptible Effects may finish, but their old notice cannot affect the new host. Notices survive screen unmount while their host remains mounted.

### 2. Once per feature: native queries and actions

The hooks accept native atoms directly. This complete component module shows query and action state without RPC setup:

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";

const report = Atom.make(Effect.succeed({ id: 1, title: "Quarterly report" }));
const rename = Atom.fn<string>()((title) =>
  title.trim() === ""
    ? Effect.fail("Title required" as const)
    : Effect.succeed({ id: 1, title: title.trim() }),
);

function Report() {
  const query = useQuery(report);
  const action = useAction(rename);
  return (
    <section>
      <QueryView
        query={query}
        content={(row) => <h1>{row.title}</h1>}
        loading={(state) => <p>{state.refreshing ? "Refreshing…" : "Loading…"}</p>}
        failure={(error, state) => (
          <p role="alert">{String(error)} <button disabled={state.pending} onClick={state.refresh}>Retry</button></p>
        )}
      />
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
  return <RegistryProvider><Report /></RegistryProvider>;
}
```

`QueryView` from `client/QueryView.ts` is stateless presentation over `QueryState<A, E>`, including an editor's `query`. Supply `content(data, query)`, `loading(query)` and `failure(error, query)` renderers. Loading renders while pending, including refreshes, or before the first result; a settled initial rejection renders failure without loading. The failure renderer receives the typed rejection and can call the query's native `refresh` to retry. The component keeps successful content in the same React position through refresh, failure and recovery, preserving mounted inputs. Keep content component types and keys stable as usual.

The hook owns retained display data and the native atom owns execution and caching. `QueryView` creates neither. Expected query rejections stay in its failure renderer; defects are thrown to the application's error boundary. It leaves field and command failures with the editor, form or action that owns them. Native `useAtomSuspense` is unchanged and still throws failures.

For both queries and actions, a successful `undefined` is `Option.some(undefined)` in `data`, with `pending` and `refreshing` false. A defect or interruption is available as `Option.some(cause)` in `cause`; `isUnauthorized` returns false for those causes and they do not request a session recheck, even when the defect has an `Unauthorized` tag.

The example's action returns a value; it does not persist the report or invalidate its query. In an application, use the native RPC query and mutation atoms instead:

```ts
const notes = useQuery(NotesClient.query("ListNotes", undefined, {
  reactivityKeys: ["notes"],
}));
const create = useAction(NotesClient.mutation("CreateNote"));

create.dispatch({
  payload: { title: "Morning walk" },
  reactivityKeys: ["notes"],
});
```

`NotesClient` is an application's `AtomRpc.Service` with `ListNotes` and `CreateNote` RPCs. The native mutation's reactivity keys refresh the matching query after success.

An action's `dispatch(input)` returns `void`. Read the atom's latest result from `data`, `cause` or `result`. With the default `Atom.fn` action, a later dispatch interrupts the earlier work and the shared state reports the later result.

### Completion inside each command invocation

Pass the native runtime and the original bound command Effect to `useAction` when the screen needs feedback for each invocation:

```tsx
const rename = useAction(ReportsClient.runtime, api.rename.run, {
  notices: {
    onSuccess: (saved, input) => ({ message: `Renamed ${input.id} to ${saved.title}` }),
    onFailure: (_error, input) => ({ message: `Could not rename ${input.id}` }),
  },
});
```

`ReportsClient` and `api` belong to the application. Input, success, typed failure and runtime requirements are inferred from the command. Use `notices` for the feedback path above. The optional synchronous `onSuccess(value, input)` and `onFailure(error, input)` callbacks are also available for application completion work. They run inside each invocation using the latest committed callbacks and that invocation's input and outcome. Rerendering a result does not replay completion, and an abandoned render cannot replace the committed callback. A callback that throws becomes a native defect; it does not call `onFailure` as a domain rejection.

The hook calls the supplied Effect once. A bound contract command still owns invalidation, and completion does not wait for invalidated queries to refetch. Undo payloads, expected versions and presentation text stay in the application.

A newer dispatch interrupts the earlier command by default. Interrupted work produces no completion feedback. Pass `{ concurrent: true, onSuccess, onFailure }` to let invocations overlap and report their own outcomes. `result`, `data`, `cause` and `pending` remain the native action atom's aggregate state, including its native result selection during concurrent execution; they do not identify an invocation. Use notice descriptors for per-invocation messages and completion callbacks for application work. Keep the runtime and concurrency policy stable for the same owner.

A typed `Unauthorized` failure asks the session owner to recheck once per failed invocation, even with concurrent commands. The hook does not sign out. Session replacement discards outgoing callbacks and rechecks, including when outgoing work cannot be interrupted.

### Better Auth actions

`authAction` from `@shivaedev/react/client/authAction.ts` turns a Better Auth client call into a native action atom. Create it with the client, then pass it to `useAction` for the same `pending`, `data`, `cause`, `result` and `dispatch` shape as commands:

```tsx
const signIn = authAction((credentials: { email: string; password: string }, signal) =>
  authClient.signIn.email(credentials, { signal }),
);

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

The example uses `authAction`, `useAction`, `effect/reactivity/AsyncResult` and `effect/Option`, with an application-owned `authClient`. Returned auth errors keep their fields in the typed failure channel. Rejected promises become `AuthActionUnavailable` with the original rejection in `cause`. The application chooses error text and what happens after success.

### Commands with a pending display value

Use `usePendingCommand` for a command acting on a query row, such as a list toggle. Give each row a stable action atom with the existing bound command, so the command's declared invalidation keys still drive refetches:

```tsx
import * as Atom from "effect/reactivity/Atom";
import { usePendingCommand } from "@shivaedev/react/client/pendingCommand.ts";

const toggle = Atom.family((id: number) =>
  ItemsClient.runtime.fn((input: { readonly enabled: boolean }) => api.toggle.run({ id, ...input })),
);
const list = api.list.query();

function EnabledToggle({ row }: { readonly row: { readonly id: number; readonly enabled: boolean } }) {
  const command = usePendingCommand(toggle(row.id), {
    queries: [list],
    value: row.enabled,
    wanted: (input) => input.enabled,
  });
  return <button aria-pressed={command.value} disabled={command.pending}
    onClick={() => command.dispatch({ enabled: !command.value })} type="button">
    Enabled
  </button>;
}
```

Each row needs its own action atom because the native atom owns its current result, including failures. `Atom.family` keeps an independent action atom stable for each row ID. This lets one row fail while another keeps its requested display through the shared list refetch. Do not share one action atom across independently controlled rows.

The example assumes a bound `api.toggle.run` accepting `{ id, enabled }`, a bound list query and their native `ItemsClient`. `queries` lists the query atoms whose refetches the display waits for; it does not add invalidations. Include every relevant query and keep the action and query atom identities stable. `value` is the current server value; `wanted(input)` computes the requested display value.

`command.value` changes on dispatch and stays at the requested value while the command or any watched query is waiting. `pending` covers that whole interval. After the queries settle, `value` follows the server again, even if it differs from the requested value. A command failure immediately returns to the server value and remains typed in `result` and `cause`, just as with `useAction`. The other action fields describe the native command result, so `result` can already be successful while `pending` still waits for refetches. This binding holds a display value; it does not write to the query cache.

### Route loaders with TanStack Router

TanStack Router owns routes, navigation, search validation, loader data and screen components. Spread `queryRoute(buildQuery)` from `@shivaedev/react/queryRoute.ts` into `createRoute` to derive loader dependencies from validated search and load a contract query atom in the router context’s registry. A rejection tagged `NotFound` renders the route’s `notFoundComponent`; other typed failures reach `errorComponent` unchanged. The atom runs through its native RPC runtime and shares its execution with React.

This example assumes an application-owned `api.get.query({ id, page })` returning `{ id, title }`, with declared `NotFound` and `NoteMissing` rejections:

```tsx
import { RegistryContext } from "@effect/atom-react";
import { createRootRouteWithContext, createRoute, createRouter, RouterProvider, useRouterState } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Effect, Option, Predicate, Schema } from "effect";
import type { ReactNode } from "react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "@shivaedev/react/queryRoute.ts";
import { useLoaderQuery } from "@shivaedev/react/client/useLoaderQuery.ts";
import { api } from "./notes-client.ts";

const registry = AtomRegistry.make();
const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry }>()();
const Search = Schema.Struct({
  page: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
    Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
    Schema.withDecodingDefaultKey(Effect.succeed(1)),
  ),
});
const note = createRoute({
  getParentRoute: () => root,
  path: "/notes/$id",
  validateSearch: Schema.toStandardSchemaV1(Search),
  ...queryRoute(({ params, search }: { params: { id: string }; search: typeof Search.Type }) =>
    api.get.query({ id: params.id, page: search.page }),
  ),
  notFoundComponent: () => <h1>Note not found</h1>,
  component: Note,
  errorComponent: Failure,
});
const router = createRouter({
  context: { registry },
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
  return <main>{pending && <p>Loading…</p>}{children}</main>;
}
function Note() {
  const query = useLoaderQuery(api.get.query({ ...note.useParams(), ...note.useSearch() }), note.useLoaderData());
  return <h1>{query.data.title}</h1>;
}
function Failure({ error }: ErrorComponentProps) {
  return <p role="alert">{Predicate.isTagged(error, "NoteMissing") ? "Note missing" : "Could not load"}</p>;
}
export function App() {
  return <RegistryContext.Provider value={registry}><RouterProvider router={router} /></RegistryContext.Provider>;
}
```

`validateSearch` stays native: `Schema.toStandardSchemaV1(Search)` supplies TanStack’s search input and output types. The schema defaults a missing or invalid page to `1`. The query callback names its params and schema output type because TypeScript cannot infer them backward through an object spread. Changing search changes the loader dependencies and queries the new payload. Keep `params`, `validateSearch`, `component`, `errorComponent` and `notFoundComponent` on the route; options after the spread can override its `loaderDeps` or `loader`.

For a loader that coordinates more work, use `loadQuery(registry, atom, loaderContext)` from `@shivaedev/react/loadQuery.ts` directly. It reads the atom in the supplied registry and throws typed failures unchanged, including `NotFound`; the loader decides how to handle them.

`defaultPendingMs: Infinity` keeps the current route's data visible during navigation; the shell reads TanStack's `isLoading` to display pending state. The new route commits when its loader settles. This is TanStack's pending policy, separate from `useQuery`'s retained display. The loader and the component share one query execution even when the route delays mounting for 650 ms, beyond the registry’s idle window. A DOM screen story proves the first render has the loaded value and the loopback RPC handler runs once.

`useLoaderQuery(atom, route.useLoaderData())` subscribes to the same atom and exposes `data` as its success type, with no `Option` or Initial result. Refetches keep the last value visible. For a loader-backed editor, pass the loader value as `useEditor({ ...config, loaded: route.useLoaderData() })`; its form is defined on the first render and `editor.query.data` is the row directly.

`SessionBoundary` gives idle atoms the default 400 ms window used by atom-react’s default registry. `loadQuery` also mounts its atom until a component commits its `useQuery` or `useLoaderQuery` subscription, or the loader’s abort signal ends its route ownership. No per-query `timeToLive` is needed. Leaving an unread route releases that mount; a DOM story verifies the atom is gone after the idle window. A new `useLoaderQuery` reader suspends until its active `loadQuery` completes, so revisiting a cached route after invalidation renders the changed data on its first frame. Already mounted readers keep their data during refreshes.

`loadQuery` waits through a native query refresh instead of returning its retained success. Typed failures are thrown directly, so the route can inspect `_tag` rather than an Effect fiber wrapper. Defects remain failed Promises. TanStack's loader `abortController` cancels the waiting subscription and rejects with `name: "AbortError"`; other readers of the same query can still complete. The application owns the registry's lifetime and disposes it when its client or session ends. Use the same registry for router context and `RegistryContext.Provider`.

Install the optional router peer when using this entry point:

```sh
pnpm add @tanstack/react-router
```

### 3. Once per feature: an editor and a create form

The next module assumes `./invoice-lines-client.ts` exports a contract-bound `api` with `get`, `save` and `create`, and its native `InvoiceLinesClient`. `get` returns `{ id, name, quantity }`; both commands return the saved row. The [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/contract/README.md) describes that binding.

```tsx
import { useCreate } from "@shivaedev/react/client/create.ts";
import { useEditor } from "@shivaedev/react/client/editor.ts";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import { useField } from "@shivaedev/form/client/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { Option, Schema } from "effect";
import { api, InvoiceLinesClient } from "./invoice-lines-client.ts";

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
        <input name="name" value={name.value} onBlur={name.onBlur}
          onChange={(event) => name.onChange(event.target.value)} />
      </label>
      {name.error && <p role="alert">{name.error}</p>}
      <label>
        Quantity
        <input name="quantity" value={quantity.value} onBlur={quantity.onBlur}
          onChange={(event) => quantity.onChange(event.target.value)} />
      </label>
      {quantity.error && <p role="alert">{quantity.error}</p>}
    </>
  );
}

export function InvoiceLineEditor({ id }: { readonly id: number }) {
  const editor = useEditor({
    query: api.get.query({ id }),
    fields: InvoiceLineFields,
    values: (line) => ({ name: line.name, quantity: String(line.quantity) }),
    save: (values) => api.save.run({ id, ...values }),
    runtime: InvoiceLinesClient.runtime,
  });
  return (
    <QueryView
      query={editor.query}
      loading={(query) => <p>{query.refreshing ? "Refreshing…" : "Loading…"}</p>}
      failure={(_error, query) => (
        <p role="alert">Could not load <button disabled={query.pending} onClick={query.refresh}>Retry</button></p>
      )}
      content={() => editor.form && (
        <form onSubmit={(event) => { event.preventDefault(); editor.save(); }}>
          <Inputs form={editor.form} />
          {Option.isSome(editor.failure) && <p role="alert">Could not save</p>}
          <button type="submit" disabled={editor.saving}>Save</button>
          <button type="button" onClick={editor.query.refresh}>Refresh</button>
          <button type="button" onClick={editor.revert}>Revert</button>
          <p>{editor.saving ? "Saving" : editor.dirty ? "Unsaved" : "Saved"}</p>
        </form>
      )}
    />
  );
}

export function InvoiceLineCreate() {
  const create = useCreate({
    fields: InvoiceLineFields,
    initialValues: { name: "", quantity: "" },
    create: api.create.run,
    runtime: InvoiceLinesClient.runtime,
  });
  return (
    <form onSubmit={(event) => { event.preventDefault(); create.save(); }}>
      <Inputs form={create.form} />
      {Option.isSome(create.failure) && <p role="alert">Could not create</p>}
      <button type="submit" disabled={create.saving}>Create</button>
      {Option.isSome(create.created) && <output>Created {create.created.value.name}</output>}
    </form>
  );
}
```

The form holds strings for both inputs. Its schema decodes `quantity` to a number before `save` or `create` receives it. `values(row)` converts server rows back to input values. The runtime supplies the services needed by schema decoding and the command Effect.

The editor's form is absent until its first row arrives. A different query atom creates a new form, so another record starts without the previous draft. Refresh results adopt untouched fields and leave edited fields alone. Saved rows supply server normalization while edits made during the save remain dirty. A refresh failure keeps the draft, and `query.refresh()` retries.

`save()` ignores a second call while saving. Submitting through form's own `useSubmit(form).run()` or setting `form.submit` also settles the editor or create hook: an editor receives the saved row, and a create records its result and resets.

A successful create replaces its form with one at `initialValues`, keeping fields edited after submission began, including while an async schema decoded it. The next entry starts without the previous entry's displayed field errors. `created` holds the successful result as an `Option`.

### One-shot create and edit

Use `useCreate` when the app already has the opening values and needs one submission. Its `create` callback accepts any submission Effect, including an update command; `created` holds that Effect's successful result. Creation above and the query-free edit below use the same form lifecycle. No upsert or new form hook is needed: creation and update remain separate domain commands with explicit payloads.

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

export function OneShotEdit({ opening, onSaved }: {
  readonly opening: VersionedLine;
  readonly onSaved: (line: VersionedLine) => void;
}) {
  const [original] = useState(opening);
  const edit = useCreate({
    fields: InvoiceLineFields,
    initialValues: { name: original.name, quantity: String(original.quantity) },
    create: (values) => api.save.run({
      id: original.id,
      expectedVersion: original.version,
      ...values,
    }),
    runtime: InvoiceLinesClient.runtime,
  });
  useEffect(() => {
    if (Option.isSome(edit.created)) onSaved(edit.created.value);
  }, [edit.created, onSaved]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); edit.save(); }}>
      <Inputs form={edit.form} />
      {Option.isSome(edit.failure) && <p role="alert">
        {edit.failure.value._tag === "Conflict"
          ? "This line changed. Reopen it to use the latest version."
          : "Could not save"}
      </p>}
      <button type="submit" disabled={edit.saving}>Save</button>
    </form>
  );
}
```

The app captures the opening record once. Pass a stable `onSaved` callback to close the dialog, navigate or record a completion message; mount a new form for another opening. Domain data, including expected versions and any Undo payload, stays in the app. A conflict exposes `failure` and keeps the input. Field rejections stay on the submitted form until corrected; stale-rejection matching belongs to form. Success uses `useCreate`'s normal reset to opening values while preserving input changed during submission, so `onSaved` owns what happens next rather than turning this into a continuing editor.

Use `useEditor` for a continuing editor that subscribes to a record, merges refreshes and receives saved rows as its new baseline. Its `loaded` option supplies the initial row, usually from a route loader; it still requires `query` because the query owns identity, refresh and invalidation. Supplying `loaded` does not make an editor query-free. In either pattern contract owns the command Effect and invalidation, form owns submission and field errors, and react exposes query state where a query exists.

### Hook configuration between renders

`useCreate` calls the latest committed render's `create`, and `useEditor` calls its latest `save`. Both hooks use the latest `rejectField` when a save fails, including when the mapper is removed to restore automatic field mapping. Inline callbacks may close over changing props or state without replacing the form or losing edits.

Changing the `fields` schema or `runtime` by reference replaces either hook's form and discards its in-memory draft and submission state. A changed editor `query` also starts a new form. Keep schemas, runtimes and query atoms outside components or memoize them; constructing a schema on every render continually replaces the form.

`initialValues` (create), `values` (editor) and `persistedDraft` are setup options, captured when the hook first creates a form and again when `fields`, `runtime` or editor `query` changes. Successful creates reuse the captured initial values and persistence options for the next entry. Changing setup options alone does not replace an existing form; remount the component with a different React `key` to apply them. An editor's `loaded` value remains a fallback for query data, as with `useLoaderQuery`.

### Field rejections and other failures

A tagged error with string `_tag` and `message`, and a `field` naming a form field, becomes that field's message by default. Other save failures appear in `failure`. Use `rejectField` when the server uses a different shape or field name:

```ts
const TitleFields = Schema.Struct({ title: Schema.String });

const editor = useEditor({
  query,
  fields: TitleFields,
  values: (row) => ({ title: row.title }),
  save,
  runtime,
  rejectField: (error) => error._tag === "SubtitleRejected"
    ? { field: "title", message: error.message }
    : undefined,
});
```

Here `save` has a tagged `SubtitleRejected` failure referring to the server's `subtitle`, while the form calls the input `title`. If a tagged error's field type includes names outside the form, `rejectField` is required at compile time. This includes a broad `string` field or an optional field whose type is broader than the form's names. The mapper can return `undefined` to leave an error as a non-field failure.

### Resume and refresh policy

Keep the signal and query identities stable:

```ts
import { resumeSignal } from "@shivaedev/react/resumeSignal.ts";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

const resume = resumeSignal({ window });
const query = Atom.makeRefreshOnSignal(resume)(Atom.make(Effect.succeed("ready")));
```

`resumeSignal` changes on visible `visibilitychange` and visible `online` events. Hidden browser events do not refresh the query. An optional `native` source subscribes a callback and returns its unsubscribe function; its callback also changes the signal. Registry disposal removes the listeners. This module uses the shared [contract resume implementation](https://github.com/ShivaeDev/platform/blob/main/packages/contract/src/resume.ts).

Use native stale-while-revalidate policy when a resume should refresh only stale data:

```ts
const query = Atom.swr(atom, {
  focusSignal: resume,
  revalidateOnFocus: true,
  staleTime: "1 hour",
});
```

`atom` is the underlying native query. `Atom.swr` owns the staleness decision; the signal only reports that the application resumed.

### Session permissions and guarded routes

Permissions come from the session payload's `user.permissions`, populated by `@shivaedev/access` through the server's role policy. `can(session, permission)` reads exact name and strength grants without making a request. `useCan()` supplies the same check from the nearest `PermissionBoundary` for component controls. A signed-out session has no grants. These checks control visibility; the server still authorizes every request.

Declare a route's requirement in TanStack's native `staticData.permission`. Install `permissionGuard` once as the root route's `beforeLoad`; it checks the matched routes before their loaders run. Signed-out visitors go to the app's `signIn` path with the full requested location in the `returnTo` search field. A signed-in session without a required grant throws the shared `Forbidden` failure.

```tsx
import { RegistryContext } from "@effect/atom-react";
import { createRootRouteWithContext, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { permission } from "@shivaedev/access/permission.ts";
import { PermissionBoundary, useCan } from "@shivaedev/react/client/permissionBoundary.ts";
import { useLoaderQuery } from "@shivaedev/react/client/useLoaderQuery.ts";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { can, type PermissionSession } from "@shivaedev/react/permissions.ts";
import { queryRoute } from "@shivaedev/react/queryRoute.ts";
import { api, registry } from "./notes-client.ts";
import { auth, SignIn } from "./auth.tsx";

const ReadNotes = permission("notes.read");
const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry }>()({
  beforeLoad: permissionGuard({ session: () => auth.session, signIn: "/login" }),
});
const note = createRoute({
  getParentRoute: () => root,
  path: "/notes/$id",
  staticData: { permission: ReadNotes },
  ...queryRoute(({ params }: { params: { id: string }; search: Record<string, never> }) =>
    api.get.query({ id: params.id, page: 1 }),
  ),
  component: () => {
    const query = useLoaderQuery(api.get.query({ ...note.useParams(), page: 1 }), note.useLoaderData());
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
    return <SignIn onSignedIn={() => router.navigate({ href: returnTo })} />;
  },
});
const router = createRouter({
  context: { registry },
  routeTree: root.addChildren([note, login]),
  disableGlobalCatchBoundary: true,
});

function Controls() {
  const can = useCan();
  return can(ReadNotes) ? <button type="button">Read notes</button> : null;
}

export function App({ session }: { readonly session: PermissionSession | undefined }) {
  return (
    <PermissionBoundary session={session} fallback={<h1>Permission denied</h1>}>
      <RegistryContext.Provider value={registry}>
        <Controls />
        <RouterProvider router={router} />
      </RegistryContext.Provider>
    </PermissionBoundary>
  );
}

const showNotes = can(auth.session, ReadNotes);
```

`auth` owns the current session and passes it to `App`; `SignIn` updates that session before invoking `onSignedIn`. Use the session's registry for router context and React, as with other query routes. Importing `permissionGuard` augments TanStack's `StaticDataRouteOption`; route options and their inference remain native.

`PermissionBoundary` renders the app's one fallback at the denied URL for a refused route, a loader's `Forbidden`, or a `useQuery`/`useLoaderQuery` result tagged `Forbidden`. Other errors propagate to an enclosing error boundary. Set TanStack's `disableGlobalCatchBoundary: true` and leave permission failures to this boundary; a route-specific `errorComponent` that consumes an error owns its rendering instead. Without a permission boundary, query failures keep their normal typed state. Like a React error boundary, remount it to clear a caught failure.

### API

`useQuery(atom)` and `useAction(atom)` return these shared fields:

| Field | Meaning |
| --- | --- |
| `result` | Native `AsyncResult<A, E>`. |
| `data` | `Option<A>` from the current or retained success. Queries can retain displayed data even when the native `result` has no value. |
| `cause` | `Option<Cause<E>>` from a failed result. |
| `pending` | The native result is waiting. |
| `refreshing` | The result is waiting and successful data is available. |

`useQuery(atom, options?)` adds `refresh(): void`; `useAction` adds `dispatch(input): void`. `QueryOptions.coalesceWindow` accepts a native Duration for live changed hints on contract-bound queries; it belongs to the query atom in its registry, so readers sharing that atom share the window. Omitting it uses the session default. `QueryOptions.keepPreviousData` defaults to `false` and controls retention across query atom changes. Same-identity refresh retention is always enabled. `result` and `cause` describe the current native query even when `data` displays a previous atom's success. Success, input and typed failure types are inferred from the supplied atom. The Effect overload is `useAction(runtime, run, options?)`, where `ActionOptions` supplies `concurrent`, `onSuccess(value, input)` and `onFailure(error, input)`; its shared state also includes the native runtime's typed failure.

Import the defining `.ts` module, such as `@shivaedev/react/client/editor.ts`. There is no root import. `useSessionRecheck()` from `client/sessionBoundary.ts` reads the boundary's `recheck` callback.

Prefer `useEditor` and `useCreate` when binding a form to a command. The lower-level modules expose the same composition pieces: `submission` from `submission.ts` makes a form and its submission snapshot reader, `rejecting` from `fieldRejection.ts` maps save failures through a submitter, and `useSaveState` from `client/saveState.ts` observes submission and invokes a success callback.

### Render tests in happy-dom

Use `@shivaedev/react/client/testing.ts` with Vitest's `happy-dom` environment. Install contract for the example's query and command declarations, and the testing peers and environment in your app's dev dependencies:

```sh
pnpm add @shivaedev/contract
pnpm add -D @shivaedev/test @effect/vitest@4.0.5 vitest happy-dom react-dom@19.3.0 @types/react-dom
```

Configure Vitest with `test: { environment: "happy-dom" }`, or select that environment for your DOM test project. This complete `notes.dom.test.tsx` renders a component that runs a declared query and command against native RPC test handlers:

```tsx
import { Effect, Option, Ref, Schema } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act, createElement } from "react";
import { expect } from "vitest";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/react/client/testing.ts";
import { it } from "@shivaedev/test/it.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

const notes = collection("notes", Schema.Number);
const List = query("list", { reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Add = command("add", { invalidates: () => [notes.list], payload: { title: Schema.String } });
const Notes = contract("notes", { commands: [Add], queries: [List] });

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const stored = yield* Ref.make<readonly string[]>([]);
		return Notes.of({
			"notes.add": ({ title }) => Ref.update(stored, (all) => [...all, title]),
			"notes.list": () => Ref.get(stored).pipe(Effect.delay("20 millis")),
		});
	}),
);
class Client extends AtomRpc.Service<Client>()("test/Notes", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: handlers,
}) {}
const api = bind(Notes, Client);
const add = Client.runtime.fn(api.add.run);
function NotesView() {
	const list = useQuery(api.list.query());
	const action = useAction(add);
	return createElement(
		"section",
		null,
		createElement("output", null, Option.getOrElse(list.data, () => []).join(", ")),
		createElement(
			"button",
			{
				disabled: list.pending || action.pending,
				onClick: () => action.dispatch({ title: "Morning walk" }),
				type: "button",
			},
			"Add",
		),
	);
}

it.live("renders a query and refetches it after a command through a test RPC layer", function* () {
	const view = yield* Effect.promise(() => render(createElement(NotesView)));
	try {
		yield* eventually(() => expect(view.container.querySelector("button")?.disabled).toBe(false));
		expect(view.container.querySelector("output")?.textContent).toBe("");
		yield* Effect.promise(() => act(async () => view.container.querySelector("button")?.click()));
		yield* eventually(() => {
			expect(view.container.querySelector("output")?.textContent).toBe("Morning walk");
			expect(view.container.querySelector("button")?.disabled).toBe(false);
		});
	} finally {
		yield* Effect.promise(view.unmount);
	}
});
```

`render(node, options?)` returns the attached `container`, its fresh native `registry`, `render(nextNode)` to update the same root and registry, and `unmount()` to release the root, registry and container. The options are React's own `RootOptions`, passed to `createRoot`, including `onCaughtError`, `onUncaughtError` and `onRecoverableError`. Always unmount in `finally`. Keep component interactions inside React's `act`. `eventually(assert)` returns an Effect: yield it directly in a story or Effect test, keeping the expectation in the spec. It retries for up to three seconds in live time, allowing pending responses to settle inside `act` between attempts without advancing the story’s TestClock. A timeout fails with an Error whose message includes the elapsed milliseconds and last assertion message, and whose `cause` is that assertion error. In an async test, use `await Effect.runPromise(eventually(assert))`. `expectNoReactWarnings()` registers a Vitest hook that fails a test if it logged to `console.error`.

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

The RPC layer stays application-owned: replace these in-memory handlers with the service Layer your component needs.

Story kits can acquire `captureReactWarnings` from `client/testing.ts` in their `create` effect with `const warnings = yield* captureReactWarnings`. The scope owns the capture and restores `console.error` when it closes, including after a failed story. Pass `warnings.onCaughtError` to `render` to capture boundary errors, or `warnings.expectCaughtError(predicate)` to exclude a declared error. Both handlers silence caught errors; the capture also silences and records `console.error` calls. `warnings.read()` returns `{ consoleErrors, caughtErrors }`, with each console call's arguments and the unexpected caught errors. It asserts nothing, leaving the story spec to state its expectation. The Vitest guard uses the same capture mechanism and additionally checks that every declared error occurred.

### Install, setup and limits

```sh
pnpm add @shivaedev/react @effect/atom-react@4.0.5 effect@4.0.5 react@19.3.0
```

For editor, create or lower-level form modules, also install the optional form peer:

```sh
pnpm add @shivaedev/form
```

Query, action, session and resume modules do not require form. The package needs Node 24 or newer.

- Query identity, TTL, invalidation and action concurrency remain native atom policies. Put the registry at the lifetime boundary those policies need.
- The package has no SSR registry/hydration adapter, offline write queue or optimistic reconciliation policy.
