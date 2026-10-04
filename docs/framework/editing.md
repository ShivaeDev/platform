# Editing a record and creating one

`useEditor` (`@shivaedev/effect-react/editor.ts`) and `useCreate` (`@shivaedev/effect-react/create.ts`) join three existing pieces:
a query atom (for example `api.get.query({ id })` from an
`@shivaedev/effect-contract` binding), an `@shivaedev/effect-form` form, and a
save Effect (`api.save.run(...)`). They add no cache, no mutation atom and no
second form model. Those two modules need the optional `@shivaedev/effect-form`
peer; the other `@shivaedev/effect-react` modules do not load it.

```ts
const editor = useEditor({
	query: api.get.query({ id }),
	fields: InvoiceLineFields,
	values: (line) => ({ name: line.name, quantity: String(line.quantity) }),
	save: (values) => api.save.run({ id, ...values }),
	runtime: InvoiceLinesClient.runtime,
});
if (editor.form === undefined) return editor.query.pending ? <Loading /> : <LoadFailed retry={editor.query.refresh} />;
return <InvoiceLineForm form={editor.form} save={editor.save} saving={editor.saving} failure={editor.failure} />;
```

Inside `InvoiceLineForm`, `useField(form, "name")` from `@shivaedev/effect-form/react.ts`
supplies value, change, blur and message.

## Behavior

- The form is created from the first successful query value and replaced when
  the query atom changes (a different id), so drafts never cross records.
- Each new query value and each saved result go through the draft's per-field
  merge: untouched fields adopt it, fields edited meanwhile keep local input.
  The server's normalized save therefore appears, while an edit made during the
  save stays dirty.
- A refresh failure keeps the previous value and the draft; `query.cause` holds
  the failure and `query.refresh()` retries.
- A tagged rejection shaped `{ _tag, field, message }` whose `field` names a
  form field (such as a contract `fieldRejection(Draft)`) becomes that field's
  message; this is the same shape `rejectedField` in `@shivaedev/platform/errors/rejected-field.ts`
  recognizes. `rejectField` overrides the mapping. Other failures appear in
  `failure`.
- If a save's error type contains a tagged rejection whose `field` type is not
  one of the form's field names (a `fieldRejection` over a different struct, or
  a plain `string`, required or optional as on `Conflict` and `BadRequest` from
  `@shivaedev/platform/errors/taxonomy.ts`), `rejectField` becomes required and the call
  does not compile without it.
- `save()` does nothing while a save is running. Submitting through
  effect-form's own API (`useSubmit(form).run()` or setting `form.submit`)
  settles the same way: the editor receives the saved row and a create resets.
- `Unauthorized` from the query or the save asks the enclosing
  `SessionBoundary` to re-check the session.

`useCreate({ fields, initialValues, create, runtime })` has the same save state
with a permanent `form` and `created: Option<A>`. After success it replaces the
form with a fresh one at `initialValues`, carrying over fields changed after the
submit was pressed (while its schema decoded or the create ran). The fresh form
has no touched or submitted state, so empty required fields do not show
messages after a reset.

## Compared with tRPC, TanStack Query and React Hook Form

| Concern | tRPC + TanStack Query + RHF | This stack |
| --- | --- | --- |
| Load | `trpc.invoiceLine.get.useQuery({ id })` | `api.get.query({ id })` passed to `useEditor` |
| Form defaults | `useForm({ defaultValues })` plus `reset(data)` in an effect once data arrives | `values(row)`; created on first data |
| Refetch while dirty | `reset` overwrites edits unless `keepDirtyValues` is set; whole-form policy | per-field merge by default |
| Save | `useMutation` + `onSuccess: invalidate` + `reset(saved)` | `save: api.save.run(...)`; contract invalidates, editor receives the result |
| Server field errors | map `error.data` to `setError(field, ...)` by hand | typed field rejection attaches automatically |
| Double submit | `disabled={isPending}` | `save()` ignores it |
| Create then reset | `reset()` after success loses edits made during the save | kept per field |
| Logout | `queryClient.clear()` plus manual form resets | `SessionBoundary` remounts and disposes the registry |

The call site is similar in length. The difference is in the defaults: refresh,
save and reset races are handled per field, and a contract field rejection is
checked against the form's field names at compile time.

## Evidence

[`invoice-line-editor.test.tsx`](../../packages/effect-react/test/invoice-line-editor.test.tsx)
renders a contract-bound invoice line editor over in-process native RPC. It covers
initial loading, refresh failure with retained data and retry, dirty refresh,
server normalization with an edit made while saving, an ignored second submit,
field and non-field failures, remounting per id, create-reset during a save and
session switch teardown with an Unauthorized re-check. It does not cover real
HTTP, browsers or optimistic updates.
