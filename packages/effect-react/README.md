# @shivaedev/effect-react

Small React hooks and a session boundary for native Effect atoms. Query data survives refreshes and failures when the underlying `AsyncResult` contains a previous success. Actions expose ordinary RPC success values and typed failures as native atom state.

This package targets Effect and `@effect/atom-react` **4.0.0-rc.112** and React 19. Native atoms own identity, caching, invalidation, serialization and cancellation. There is no second query cache or RPC contract language.

## Native RPC usage

Given an `Api` service constructed with native `AtomRpc.Service`, and RPCs `Meals` and `RenameMeal`:

```tsx
import { RegistryProvider } from "@effect/atom-react"
import { useAction, useQuery } from "@shivaedev/effect-react"
import { Option } from "effect"

function Meals() {
  const meals = useQuery(Api.query("Meals", {}, {
    reactivityKeys: ["meals"],
    timeToLive: "1 minute",
  }))
  const rename = useAction(Api.mutation("RenameMeal"))

  function save(id: string, title: string) {
    rename.dispatch({
      payload: { id, title },
      reactivityKeys: ["meals"],
    })
  }

  if (Option.isNone(meals.data)) {
    return Option.isSome(meals.cause)
      ? <button onClick={meals.refresh}>Retry</button>
      : <p>Loading…</p>
  }
  return <MealList meals={meals.data.value} refreshing={meals.refreshing}
    pending={rename.pending} onRename={save} />
}

function App() {
  return <RegistryProvider><Meals /></RegistryProvider>
}
```

`Api` and `MealList` above are application definitions. The hooks also accept non-RPC atoms built with `Atom.make`, `Atom.fn` or an atom runtime. Stable atom identities should be declared outside render, created with native `Atom.family`, or memoized; native `Api.query(...)` already supplies its own family.

## Editing

`useEditor` and `useCreate` from `@shivaedev/effect-react/form` bind `@shivaedev/effect-form` to a query atom and a save Effect, for example from an `@shivaedev/effect-contract` binding `api`. `@shivaedev/effect-form` is an optional peer dependency: install it only when you import this subpath; the root entry does not load it. See the [editing guide](../../docs/framework/editing.md).

```ts
const editor = useEditor({
  query: api.get.query({ id }),
  fields: FoodFields,
  values: (food) => ({ name: food.name, grams: String(food.grams) }),
  save: (values) => api.save.run({ id, ...values }),
  runtime: FoodsClient.runtime,
})
// editor.query: QueryState; editor.form: Form | undefined until data first arrives
// editor.save(), editor.saving, editor.dirty, editor.failure (non-field failures), editor.revert()
```

The form is created from the first successful value and replaced when the query atom changes, so a different id never inherits a draft. Each new query value and each saved result is received per field: untouched fields adopt it, fields edited meanwhile keep local input. A tagged failure shaped `{ _tag, field, message }` whose `field` names a form field, such as an `@shivaedev/effect-contract` `fieldRejection`, becomes that field's message; pass `rejectField` to map differently. When a tagged rejection's `field` type names a field the form lacks, `rejectField` is required at compile time. Other failures appear in `failure`. `save()` does nothing while a save is running; submitting through the form's own `submit` atom settles the same way. Render fields with `useField(editor.form, name)` from `@shivaedev/effect-form/react`.

`useCreate({ fields, initialValues, create, runtime, rejectField })` returns the same save state with an always-present `form` and `created: Option<A>`. After success it replaces the form with a fresh one at `initialValues`, carrying over fields changed while the create was in flight, so their messages and submitted state do not leak into the next entry.

## State

Both hooks return:

- `result`: the unchanged native `AsyncResult`, including its discriminant and typed failure.
- `data`: `Option<A>`, using the current or previous successful result. A valid `undefined` success remains `Some(undefined)`.
- `cause`: `Option<Cause<E>>`, preserving failures, defects and interruption information.
- `pending`: whether the native result is waiting, including refreshes.
- `refreshing`: waiting while successful data is available.

`useQuery(atom)` additionally returns `refresh()`. It does not carry data across different query atoms. `useAction(atom)` additionally returns `dispatch(input): void`. Read its ordinary success value from `data` and errors from `cause` or the discriminated `result`. Dispatch does not return a completion promise. For imperative per-invocation outcomes (such as closing only the editor whose save succeeded), execute the actual native RPC Effect through your application runtime.

## Scope and concurrency

Mount `SessionBoundary` at the authenticated root. For each session key it builds one credential-bound client and one registry, remounts its subtree when the key changes, renders `signedOut` without a session and disposes the outgoing registry. `connect` runs once per key, so a client must read a rotating credential per request, or the key must include a credential generation. A subtree hidden by `<Activity>` keeps its state and gets a fresh registry on reveal. Inside it, `useQuery` and `useAction` call the boundary's `recheck` when a result fails with a tagged `Unauthorized` error; they keep retained data until the auth owner ends the session. See [client lifecycle](../../docs/framework/client-lifecycle.md). SSR isolation is not implemented.

`resumeSignal({ window, native })` is an atom that increments when the page becomes visible, when the network returns while visible, and when an injected native resume source fires. Feed it to native `Atom.makeRefreshOnSignal` or to `Atom.swr` as `focusSignal`.

State belongs to the **supplied atom in the registry**, not to an individual hook call. In particular, native `Api.mutation("RenameMeal")` returns the same atom for that operation. Components using it share pending/result state and the native action's concurrency behavior. With the default native action, a later dispatch interrupts the earlier one; shared state then represents the later action. Disable duplicate submissions, or create distinct native action atoms when independent lifetimes are needed. Native registry retention and disposal govern cleanup. The package adds no optimistic policy, offline queue, form state or parallel action scheduler.

## Validation

React DOM tests exercise native atom execution, refresh retention, typed failures and query identity changes. Compiler fixtures check success/input/error inference. The package smoke test installs its tarball into a standalone consumer and checks both compiler versions and NodeNext resolution.
