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

State belongs to an **atom in a registry**. A query hook reads that atom's native `AsyncResult`; an action hook reads and dispatches a native action atom. Two readers of the same query share its execution. Changing the query atom changes the data being read: the hook does not carry the previous atom's data into the next one.

`useQuery` and `useAction` turn native results into `data`, `cause`, `pending` and `refreshing`. A refresh or failure can still contain a previous success, so a component can show data and an error together. Keep the atom's identity stable for the same work: declare it outside render or use the native family's identity, such as `AtomRpc.Service.query(...)`.

An **editor** joins a query atom, an effect-form field schema and a save Effect. The query provides the row; `values(row)` converts it to input values; the schema decodes those values before the save runs. effect-form owns the draft and the per-field merge. A **create form** uses the same submission rules without a query and starts a fresh form after success.

A **session generation** is the string returned by `identify(session)`. `SessionBoundary` owns its client, registry and React subtree. Your auth owner supplies the session and decides when to replace or end it. Cache policy, RPC declarations and transport stay with native Effect and the application; this package supplies their React state and lifecycle boundary.

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
import { SessionBoundary } from "@shivaedev/effect-react/session-boundary.ts";
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

A query that fails with a tagged `Unauthorized` asks `recheck` to run and keeps its retained data. The auth owner can retry the same session or remove it; the hook does not sign the user out. The boundary also handles React StrictMode's effect replay and preserves component state across hiding and revealing an `<Activity>` subtree, supplying a live registry when revealed.

### 2. Once per feature: native queries and actions

The hooks accept native atoms directly. This complete component module shows query and action state without RPC setup:

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { useAction, useQuery } from "@shivaedev/effect-react/result-state.ts";
import { Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

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

`NotesClient` is an application's `AtomRpc.Service` with `ListNotes` and `CreateNote` RPCs. The native mutation's reactivity keys refresh the matching query after success. The package's rendered native RPC fixture exercises this shape through a real repository, including a rejected save that preserves the list.

An action's `dispatch(input)` returns `void`. Read the atom's latest result from `data`, `cause` or `result`. With the default `Atom.fn` action, a later dispatch interrupts the earlier work and the shared state reports the later result. Disable duplicate submissions or give independent work distinct native action atoms. When one caller needs its own success or failure, run the actual RPC Effect through its runtime, as the editor's `save` does; shared atom state cannot identify one invocation's completion.

### 3. Once per feature: an editor and a create form

The next module assumes `./invoice-lines-client.ts` exports a contract-bound `api` with `get`, `save` and `create`, and its native `InvoiceLinesClient`. `get` returns `{ id, name, quantity }`; both commands return the saved row. The [contract guide](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/README.md) describes that binding.

```tsx
import { useCreate } from "@shivaedev/effect-react/create.ts";
import { useEditor } from "@shivaedev/effect-react/editor.ts";
import { useField } from "@shivaedev/effect-form/react.ts";
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
import { resumeSignal } from "@shivaedev/effect-react/resume-signal.ts";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

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
| `data` | `Option<A>` from the current or retained successful result. |
| `cause` | `Option<Cause<E>>` from a failed result. |
| `pending` | The native result is waiting. |
| `refreshing` | The result is waiting and successful data is available. |

`useQuery` adds `refresh(): void`; `useAction` adds `dispatch(input): void`. Success, input and typed failure types are inferred from the supplied atom.

| Defining module | Exports |
| --- | --- |
| `result-state.ts` | `useQuery`, `useAction`, `isUnauthorized`; `ResultState`, `QueryState`, `ActionState`. |
| `session-boundary.ts` | `SessionBoundary`, `useSessionRecheck`; `SessionBoundaryProps`. |
| `editor.ts` | `useEditor`; `Editor`, `EditorConfig`. |
| `create.ts` | `useCreate`; `Create`, `CreateConfig`. |
| `resume-signal.ts` | `resumeSignal`; `ResumeSource`, `ResumeWindow`, `ResumeOptions`. |
| `save-state.ts` | `useSaveState`; `SaveState`. |
| `field-rejection.ts` | `fieldRejectionOf`, `rejecting`; `FieldRejection`, `RejectField`, `FieldRejectionMapping`, `AtomServices`. |
| `submission.ts` | `submission`; `Submission`, `SubmissionConfig`. |

Import the defining `.ts` module, such as `@shivaedev/effect-react/editor.ts`. There is no root import. `SessionBoundaryProps` supplies `session`, `identify`, `connect`, `recheck`, a client-to-children function and optional `signedOut`; `useSessionRecheck()` reads that boundary's callback.

`Editor` exposes `query`, optional `form` and `SaveState`; `Create` exposes `form`, `created` and `SaveState`. `SaveState` has `save`, `saving`, `dirty`, `failure` and `revert`. Prefer the two complete hooks when binding a form to a command. The lower-level form modules expose the same composition pieces: `submission` makes a form and its submission snapshot reader, `rejecting` maps save failures through a submitter, and `useSaveState` observes submission and invokes a success callback.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-react @effect/atom-react@4.0.0-rc.112 effect@4.0.0-rc.112 react@19.2.8
```

For editor, create or lower-level form modules, also install the optional form peer:

```sh
pnpm add @shivaedev/effect-form
```

Query, action, session and resume modules do not require effect-form. The package declares Node 24 or newer and peers on Effect, atom-react and React; this repository checks Effect and atom-react `4.0.0-rc.112` with React `19.2.8`.

- Query identity, TTL, invalidation and action concurrency remain native atom policies. Put the registry at the lifetime boundary those policies need.
- Action state describes the atom's latest result. A `dispatch` is not a Promise or a separate result handle.
- A session generation is application-defined. Credentials captured by `connect` require a changed generation when they rotate.
- The package has no SSR registry/hydration adapter, offline write queue or optimistic reconciliation policy.
- DOM tests and an injected resume source do not prove real-browser or mobile lifecycle behavior. The real HTTP order fixture proves its local composition, not a deployed host's auth, cancellation or rendering policy.

The full design is in [the north star](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/docs/north-star.md). Implementation status and unresolved choices are in [the roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/docs/roadmap.md).
