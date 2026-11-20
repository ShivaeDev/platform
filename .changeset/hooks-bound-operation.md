---
"@shivaedev/react": minor
"@shivaedev/contract": minor
"@shivaedev/admin": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/contract`: a bound command carries `runtime`, the atom runtime of its client, and `payload`, its declared payload schema. Bound queries and streams carry `runtime` too.
- `@shivaedev/react`: `useCreate` and `useEditor` take their form fields from the command's payload schema when `fields` is omitted, and `useEditor` fills its inputs by encoding each row with those fields when `values` is omitted. `fixed` supplies the payload fields the form does not edit, and every save sends `{ ...fixed, ...values }`. `fixed` and the form's fields must cover the payload exactly: a missing key, a key outside the payload or a value of the wrong type does not compile, and the error names the key. Passing a bound query where a command belongs reports `a bound query only reads: read it with useQuery, and pass a command here`.

### Breaking

- `@shivaedev/react`: `useAction` takes the bound command instead of a runtime and its `run`. The plain action atom form `useAction(atom)` is unchanged. Before: `useAction(NotesClient.runtime, api.remove.run, { onSuccess })`. After: `useAction(api.remove, { onSuccess })`. For an Effect that is not a single bound command, pass `{ run, runtime }`: `useAction({ run: save, runtime: NotesClient.runtime })`.
- `@shivaedev/react`: `useCreate` takes the operation first and its options second; the `create` and `runtime` options are gone, and `fields` is optional. Before: `useCreate({ fields: NoteFields, initialValues: { title: "" }, create: api.create.run, runtime: NotesClient.runtime })`. After: `useCreate(api.create, { initialValues: { title: "" } })`. Keep `fields` when an input holds another encoding than the payload, such as `Schema.NumberFromString` for a number typed as text.
- `@shivaedev/react`: `useEditor` takes the operation first and its options second; the `save` and `runtime` options are gone, and `fields` and `values` are optional. Before: `useEditor({ query: api.get.query({ id }), fields: NoteFields, values: (note) => ({ title: note.title }), save: (values) => api.update.run({ id, ...values }), runtime: NotesClient.runtime })`. After: `useEditor(api.update, { query: api.get.query({ id }), fixed: { id } })`. Pass `values(row)` when the row's shape differs from the fields; a payload field the row lacks, such as an expected version, goes in `fixed`. A save that composes several Effects passes `{ run, runtime }` as the operation: `useEditor({ run: (values) => save(id, values), runtime }, { fields, query, values })`.
- `@shivaedev/react`: `useUndoableChange` and `usePendingCommand` take the bound command itself, and `useUndoableChange` takes `update` in its options. Before: `useUndoableChange({ ...api.change, runtime: NotesClient.runtime, update }, { describe })` and `usePendingCommand({ ...api.toggle, runtime: ItemsClient.runtime }, { value, wanted })`. After: `useUndoableChange(api.change, { describe, update })` and `usePendingCommand(api.toggle, { value, wanted })`. The `VersionedChangeCommand` and `PendingCommand` types are removed; both hooks accept any `{ run, runtime }`.
- `@shivaedev/react`: the `CreateConfig` and `EditorConfig` types are now `CreateOptions` and `EditorOptions`, without the operation's members.
- `@shivaedev/admin`: `SessionsView` takes the bound revoke command as `revoke` and no longer takes `runtime`. Before: `<SessionsView revoke={client.sessions.revoke.run} runtime={client.runtime} … />`. After: `<SessionsView revoke={client.sessions.revoke} … />`.

### Changed

- `@shivaedev/create-app`: the starter's notes screens call `useCreate(client.api.create, …)`, `useEditor(client.api.update, …)` and `useAction(client.api.delete, …)`, and its sessions page passes the bound revoke command.
