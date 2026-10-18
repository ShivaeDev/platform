# @shivaedev/effect-react

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

An **editor** joins a query atom, an effect-form field schema and a save Effect. The query provides the row; `values(row)` converts it to input values; the schema decodes those values before the save runs. effect-form owns the draft and the per-field merge. A **create form** uses the same submission rules without a query and starts a fresh form after success.

A **session generation** is the string returned by `identify(session)`. `SessionBoundary` owns its client, registry and React subtree. Your auth owner supplies the session and decides when to replace or end it. Cache policy, RPC declarations and transport stay with native Effect and the application; this package supplies their React state and lifecycle boundary.

`useEditor` and `useCreate` opt into persisted input with `persistedDraft: { key }`. Choose a stable key for the record or create request, independent of its server revision. The adapters use effect-form's browser storage and inherit ownership from `SessionBoundary`: reload and query refresh preserve edits, successful submission clears accepted input, and a committed session replacement drops tracked drafts. A suspended replacement that is canceled keeps the visible session's draft and future writes. Later edits made during a save remain persisted. Optional `storage`, `maxBytes` and `maxAgeMs` customize the provider and bounds; defaults are `localStorage`, 256 KiB of UTF-8 JSON and seven days. See [effect-form's persisted input API](https://github.com/ShivaeDev/platform/tree/main/packages/effect-form#persist-input-across-reloads) for direct form hooks and limits.

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
import { SessionBoundary } from "@shivaedev/effect-react/client/sessionBoundary.ts";
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

A query that fails with a tagged `Unauthorized` asks `recheck` to run and keeps its retained data. An action does the same once per failed result, retaining its last successful `data` and the typed failure in `cause`; rerendering that result does not repeat the recheck. The auth owner can retry the same session or remove it; the hook does not sign the user out. The boundary also handles React StrictMode's effect replay and preserves component state across hiding and revealing an `<Activity>` subtree, supplying a live registry when revealed.

### 2. Once per feature: native queries and actions

The hooks accept native atoms directly. This complete component module shows query and action state without RPC setup:

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { useAction, useQuery } from "@shivaedev/effect-react/client/resultState.ts";
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
      {Option.match(query.data, {
        onNone: () => <p>Loading…</p>,
        onSome: (row) => <h1>{row.title}</h1>,
      })}
      {query.refreshing && <p>Refreshing…</p>}
      {Option.isSome(query.cause) && <p role="alert">Could not load</p>}
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

An action's `dispatch(input)` returns `void`. Read the atom's latest result from `data`, `cause` or `result`. With the default `Atom.fn` action, a later dispatch interrupts the earlier work and the shared state reports the later result. Disable duplicate submissions or give independent work distinct native action atoms. When one caller needs its own success or failure, run the actual RPC Effect through its runtime, as the editor's `save` does; shared atom state cannot identify one invocation's completion.

### Route loaders with TanStack Router

TanStack Router owns routes, navigation, loader data and error components. `@shivaedev/effect-react/loadQuery.ts` supplies `loadQuery(registry, atom, loaderContext)` to read a contract query atom in the same registry as React. The atom runs through its native RPC runtime; the loader does not create another runtime or query cache.

This example assumes an application-owned `api.get.query({ id })` returning `{ id, title }`, with a declared `NoteMissing` rejection:

```tsx
import { RegistryContext } from "@effect/atom-react";
import { createRootRouteWithContext, createRoute, createRouter, Outlet, RouterProvider, useRouterState } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Predicate } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/loadQuery.ts";
import { api } from "./notes-client.ts";

const registry = AtomRegistry.make();
const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry }>()({
  component: Shell,
});
const note = createRoute({
  getParentRoute: () => root,
  path: "/notes/$id",
  loader: (context) => loadQuery(context.context.registry, api.get.query(context.params), context),
  component: Note,
  errorComponent: Failure,
});
const router = createRouter({
  context: { registry },
  routeTree: root.addChildren([note]),
  defaultPendingMs: Infinity,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function Shell() {
  const pending = useRouterState({ select: (state) => state.isLoading });
  return <main>{pending && <p>Loading…</p>}<Outlet /></main>;
}
function Note() {
  const row = note.useLoaderData();
  return <h1>{row.title}</h1>;
}
function Failure({ error }: ErrorComponentProps) {
  return <p role="alert">{Predicate.isTagged(error, "NoteMissing") ? "Note missing" : "Could not load"}</p>;
}
export function App() {
  return <RegistryContext.Provider value={registry}><RouterProvider router={router} /></RegistryContext.Provider>;
}
```

`defaultPendingMs: Infinity` keeps the current route's data visible during navigation; the shell reads TanStack's `isLoading` to display pending state. The new route commits when its loader settles. This is TanStack's pending policy, separate from `useQuery`'s retained display. The loader and the component share one query execution.

`loadQuery` waits through a native query refresh instead of returning its retained success. Typed failures are thrown directly, so the route can inspect `_tag` rather than an Effect fiber wrapper. Defects remain failed Promises. TanStack's loader `abortController` cancels the waiting subscription and rejects with `name: "AbortError"`; other readers of the same query can still complete. The application owns the registry's lifetime and disposes it when its client or session ends. Use the same registry for router context and `RegistryContext.Provider`.

Install the optional router peer when using this entry point:

```sh
pnpm add @tanstack/react-router
```

### 3. Once per feature: an editor and a create form

The next module assumes `./invoice-lines-client.ts` exports a contract-bound `api` with `get`, `save` and `create`, and its native `InvoiceLinesClient`. `get` returns `{ id, name, quantity }`; both commands return the saved row. The [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/README.md) describes that binding.

```tsx
import { useCreate } from "@shivaedev/effect-react/client/create.ts";
import { useEditor } from "@shivaedev/effect-react/client/editor.ts";
import { useField } from "@shivaedev/effect-form/client/react.ts";
import type { Form } from "@shivaedev/effect-form/shape.ts";
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
  if (editor.form === undefined) {
    return Option.isSome(editor.query.cause)
      ? <button onClick={editor.query.refresh}>Retry</button>
      : <p>Loading…</p>;
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); editor.save(); }}>
      <Inputs form={editor.form} />
      {Option.isSome(editor.query.cause) && <p role="alert">Could not refresh</p>}
      {Option.isSome(editor.failure) && <p role="alert">Could not save</p>}
      <button type="submit" disabled={editor.saving}>Save</button>
      <button type="button" onClick={editor.query.refresh}>Refresh</button>
      <button type="button" onClick={editor.revert}>Revert</button>
      <p>{editor.saving ? "Saving" : editor.dirty ? "Unsaved" : "Saved"}</p>
    </form>
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

`save()` ignores a second call while saving. Submitting through effect-form's own `useSubmit(form).run()` or setting `form.submit` also settles the editor or create hook: an editor receives the saved row, and a create records its result and resets.

A successful create replaces its form with one at `initialValues`, keeping fields edited after submission began, including while an async schema decoded it. The next entry starts without the previous entry's displayed field errors. `created` holds the successful result as an `Option`.

### Field rejections and other failures

A tagged error with string `_tag` and `message`, and a `field` naming a form field, becomes that field's message by default. Other save failures appear in `failure`. Use `rejectField` when the server uses a different shape or field name:

```ts
const editor = useEditor({
  query,
  fields: Schema.Struct({ title: Schema.String }),
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
import { resumeSignal } from "@shivaedev/effect-react/resumeSignal.ts";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

const resume = resumeSignal({ window });
const query = Atom.makeRefreshOnSignal(resume)(Atom.make(Effect.succeed("ready")));
```

`resumeSignal` changes on visible `visibilitychange` and visible `online` events. Hidden browser events do not refresh the query. An optional `native` source subscribes a callback and returns its unsubscribe function; its callback also changes the signal. Registry disposal removes the listeners. This module uses the shared [effect-contract resume implementation](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/src/resume.ts).

Use native stale-while-revalidate policy when a resume should refresh only stale data:

```ts
const query = Atom.swr(atom, {
  focusSignal: resume,
  revalidateOnFocus: true,
  staleTime: "1 hour",
});
```

`atom` is the underlying native query. `Atom.swr` owns the staleness decision; the signal only reports that the application resumed.

### API

`useQuery(atom)` and `useAction(atom)` return these shared fields:

| Field | Meaning |
| --- | --- |
| `result` | Native `AsyncResult<A, E>`. |
| `data` | `Option<A>` from the current or retained success. Queries can retain displayed data even when the native `result` has no value. |
| `cause` | `Option<Cause<E>>` from a failed result. |
| `pending` | The native result is waiting. |
| `refreshing` | The result is waiting and successful data is available. |

`useQuery(atom, options?)` adds `refresh(): void`; `useAction` adds `dispatch(input): void`. `QueryOptions.keepPreviousData` defaults to `false` and controls retention across query atom changes. Same-identity refresh retention is always enabled. `result` and `cause` describe the current native query even when `data` displays a previous atom's success. Success, input and typed failure types are inferred from the supplied atom.

Import the defining `.ts` module, such as `@shivaedev/effect-react/client/editor.ts`. There is no root import. `useSessionRecheck()` from `client/sessionBoundary.ts` reads the boundary's `recheck` callback.

Prefer `useEditor` and `useCreate` when binding a form to a command. The lower-level modules expose the same composition pieces: `submission` from `submission.ts` makes a form and its submission snapshot reader, `rejecting` from `fieldRejection.ts` maps save failures through a submitter, and `useSaveState` from `client/saveState.ts` observes submission and invokes a success callback.

### Render tests in happy-dom

Use `@shivaedev/effect-react/client/testing.ts` with Vitest's `happy-dom` environment. Install effect-contract for the example's query and command declarations, and the testing peers and environment in your app's dev dependencies:

```sh
pnpm add @shivaedev/effect-contract
pnpm add -D vitest happy-dom react-dom@19.3.0 @types/react-dom
```

Configure Vitest with `test: { environment: "happy-dom" }`, or select that environment for your DOM test project. This complete `notes.dom.test.tsx` renders a component that runs a declared query and command against native RPC test handlers:

```tsx
import { Effect, Option, Ref, Schema } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act, createElement } from "react";
import { expect, it } from "vitest";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { useAction, useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/client/testing.ts";

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

it("renders a query and refetches it after a command through a test RPC layer", async () => {
	const view = await render(createElement(NotesView));
	try {
		await eventually(() => expect(view.container.querySelector("button")?.disabled).toBe(false));
		expect(view.container.querySelector("output")?.textContent).toBe("");
		await act(async () => view.container.querySelector("button")?.click());
		await eventually(() => {
			expect(view.container.querySelector("output")?.textContent).toBe("Morning walk");
			expect(view.container.querySelector("button")?.disabled).toBe(false);
		});
	} finally {
		await view.unmount();
	}
});
```

`render(node)` returns the attached `container`, its fresh native `registry`, `render(nextNode)` to update the same root and registry, and `unmount()` to release the root, registry and container. Always unmount in `finally`. Keep component interactions inside React's `act`. `eventually(assert)` retries the assertion for up to three seconds, allowing pending responses to settle inside `act` between attempts; it throws the last assertion failure on timeout. `expectNoReactWarnings()` registers a Vitest hook that fails a test if it logged to `console.error`.

The RPC layer stays application-owned: replace these in-memory handlers with the service Layer your component needs.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-react @effect/atom-react@4.0.4 effect@4.0.4 react@19.3.0
```

For editor, create or lower-level form modules, also install the optional form peer:

```sh
pnpm add @shivaedev/effect-form
```

Query, action, session and resume modules do not require effect-form. The package needs Node 24 or newer.

- Query identity, TTL, invalidation and action concurrency remain native atom policies. Put the registry at the lifetime boundary those policies need.
- The package has no SSR registry/hydration adapter, offline write queue or optimistic reconciliation policy.
