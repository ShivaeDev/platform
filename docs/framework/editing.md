# Editing a record and creating one

`useEditor` (`@shivaedev/react/client/editor.ts`) and `useCreate` (`@shivaedev/react/client/create.ts`) join three existing pieces: a query atom (for example `api.get.query({ id })` from an `@shivaedev/contract` binding), an `@shivaedev/form` form, and a bound command (`api.save`), which carries its runtime and payload schema. They add no cache, no mutation atom and no second form model. `@shivaedev/react` depends directly on `@shivaedev/form`; `SessionBoundary` also uses form's draft session context to own persisted drafts.

```ts
const editor = useEditor(api.save, { query: api.get.query({ id }), fields: InvoiceLineFields, fixed: { id } });
if (editor.form === undefined) return editor.query.pending ? <Loading /> : <LoadFailed retry={editor.query.refresh} />;
return <InvoiceLineForm form={editor.form} save={editor.save} saving={editor.saving} />;
```

`InvoiceLineFields` holds the quantity as text; without it the fields would be the command's payload fields minus `fixed`. The editor fills the inputs by encoding each row with those fields, and every save sends `{ ...fixed, ...values }`. `fixed` and the fields must cover the payload exactly, or the call does not compile and the error names the key. Inside `InvoiceLineForm`, `useField(form, "name")` from `@shivaedev/form/react.ts` supplies value, change, blur and message.

## Behavior

- The form is created from the first successful query value and replaced when the query atom changes (a different id), so drafts never cross records.
- Each new query value and each saved result go through the draft's per-field merge: untouched fields adopt it, fields edited meanwhile keep local input. The server's normalized save therefore appears, while an edit made during the save stays dirty.
- A refresh failure keeps the previous value and the draft; `query.cause` holds the failure and `query.refresh()` retries.
- A tagged rejection shaped `{ _tag, field, message }` whose `field` names a form field (such as a contract `fieldRejection(Draft)`, or a `Conflict` with a `field`) becomes that field's message; this is the same shape `rejectedField` in `@shivaedev/errors/rejectedField.ts` recognizes.
- Any other shared rejection from `@shivaedev/errors/taxonomy.ts` publishes its server message through the application's `NoticeHost`, and a lost connection, a server outage or a defect reaches the host's one failure wording. The screen writes no failure handling for these; the typed error also stays in `failure`.
- A rejection the application declared for itself, including one whose `field` can only name fields the form lacks, needs a handler keyed by its tag in `failures`, and the call does not compile without it: `failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) }`, written inline in the component. A handler returns a notice, a field rejection or `"silent"`, and `"message"` shows the error's own message. `silent: true` shows nothing for the whole save. The [react README](../../packages/react/README.md#failures-of-commands-and-saves) has the full rule.
- `save()` does nothing while a save is running. Submitting through form's own API (`useSubmit(form).run()` or setting `form.submit`) settles the same way: the editor receives the saved row and a create resets.
- `Unauthorized` from the query or the save asks the enclosing `SessionBoundary` to re-check the session; a save also shows its message.

`useCreate(api.create, { initialValues })` has the same save state with a permanent `form` and `created: Option<A>`. After success it replaces the form with a fresh one at `initialValues`, carrying over fields changed after the submit was pressed (while its schema decoded or the create ran). The fresh form has no touched or submitted state, so empty required fields do not show messages after a reset.

## Compared with tRPC, TanStack Query and React Hook Form

| Concern             | tRPC + TanStack Query + RHF                                                    | This stack                                                                  |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Load                | `trpc.invoiceLine.get.useQuery({ id })`                                        | `api.get.query({ id })` passed to `useEditor`                               |
| Form defaults       | `useForm({ defaultValues })` plus `reset(data)` in an effect once data arrives | the row encoded with the fields; created on first data                      |
| Refetch while dirty | `reset` overwrites edits unless `keepDirtyValues` is set; whole-form policy    | per-field merge by default                                                  |
| Save                | `useMutation` + `onSuccess: invalidate` + `reset(saved)`                       | `save: api.save.run(...)`; contract invalidates, editor receives the result |
| Server field errors | map `error.data` to `setError(field, ...)` by hand                             | typed field rejection attaches automatically                                |
| Double submit       | `disabled={isPending}`                                                         | `save()` ignores it                                                         |
| Create then reset   | `reset()` after success loses edits made during the save                       | kept per field                                                              |
| Logout              | `queryClient.clear()` plus manual form resets                                  | `SessionBoundary` remounts and disposes the registry                        |

The call site is similar in length. The difference is in the defaults: refresh, save and reset races are handled per field, and a contract field rejection is checked against the form's field names at compile time.

## Worked example

The [starter editor](../../examples/starter/src/modules/notes/client/Edit.tsx) uses `useEditor` with the query its typed `/notes/$noteId` route loads: it spreads the route's `useLoaded()`, which supplies that query and the loaded row, as in `useEditor(client.update, { ...note, fixed: { id: noteId } })`. Its updates and deletes are versioned, and a stale one answers `Conflict`.
