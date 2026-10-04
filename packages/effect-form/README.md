# @shivaedev/effect-form

Schema-derived form state built on Effect atoms. The core has no React dependency; optional hooks are exported from `@shivaedev/effect-form/react.ts`.

```ts
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make } from "@shivaedev/effect-form/form.ts";

const runtime = Atom.runtime(Layer.empty);
const profile = make(Schema.Struct({ name: Schema.NonEmptyString }), {
  initialValues: { name: "" },
  runtime,
  onSubmit: (values, submitter) =>
    values.name === "reserved"
      ? submitter.fail("name", "Choose another name")
      : Effect.succeed(values),
});
```

Fields hold the schema's encoded values; submission snapshots and decodes them before calling the handler. The handler receives the decoded values and, as its third argument, the encoded snapshot that was submitted (edits made while an async schema decodes are not part of it). Its dependencies and schema decoding services must be provided by the supplied atom runtime. Its success and error types are preserved in `form.submit`.

Submit handlers can also use the native runtime's `Scope`, `AtomRegistry`, and `Reactivity` services. For example, wrap a successful RPC save in `Reactivity.mutation(keys)` to invalidate queries in the same atom runtime. Application services still need to be supplied by the configured runtime.

Use an AtomRegistry to mount/read atoms and call `registry.set(profile.submit, undefined)` to submit. In React, use the atom-react registry provider and the hooks:

```tsx
import { useField, useSubmit } from "@shivaedev/effect-form/react.ts";

function Profile() {
  const name = useField(profile, "name");
  const submit = useSubmit(profile);
  return <form onSubmit={(event) => { event.preventDefault(); submit.run(); }}>
    <input value={name.value} onBlur={name.onBlur}
      onChange={(event) => name.onChange(event.target.value)} />
    <span>{name.error}</span>
    <button disabled={submit.submitting}>Save</button>
  </form>;
}
```

Create one stable form instance per editing session; do not recreate it during every render. Applications own general submission error rendering through `submit.result`.

- Field errors appear after a change, blur, or submission. Editing clears a server field rejection.
- Optional debounced `checks` provide advisory field messages. A message shows only while the field still holds the value it was computed for; pending, failed or outdated checks show nothing. They do not block submission; authoritative validation belongs in the schema or submit handler.
- `receive(values)` merges per field: a field that still equals its baseline adopts the received value (an optional key the refresh omits disappears), an edited field keeps its local value, and the received values become the baseline. `revert()` restores the latest received baseline.
- Successful submission accepts the submitted encoded values as the baseline. Edits made while saving stay dirty. If a refresh arrived while the save was in flight, it stays the baseline; fields still holding the submitted values count as saved and adopt the next received values.
- `emptyAsNull(schema)` maps an empty input string to nullable domain values.

This package handles top-level fields. Nested error paths map to their first field; it does not provide nested field arrays or a general nested form DSL. Draft comparisons use Effect equality per field; callers should replace values instead of mutating them in place.

Install `effect` with the package. For React hooks also install compatible `@effect/atom-react` and React 19. This initial release targets Effect `4.0.0-rc.112`.
