# @shivaedev/effect-form

Keep input values, decoded submissions and fresh server data in one form. Define fields with Effect Schema, submit domain values, and preserve local edits when a refresh or save finishes.

## Why you want this

An input gives you a string; your service needs a number. Meanwhile, fresh server data can arrive beside an unsaved edit. Repeating those conversions and merge rules in components makes every form another state machine. Here, the schema owns the conversion and the form owns the editing session:

```ts
const order = make(Schema.Struct({ name: Schema.String, quantity: Schema.NumberFromString }), {
  initialValues: { name: "Paper", quantity: "300" },
  onSubmit: Effect.succeed,
  runtime,
});

order.change("name", "Copy paper");
order.receive({ name: "Paper", quantity: "350" });
```

The name stays `"Copy paper"`; the untouched quantity becomes `"350"`. Submitting gives the handler quantity `350`, a number. The same form can be used through native atoms or small React hooks, so the component does not need another draft model.

## Using it

### How to think about it

A form is one **editing session** over a `Schema.Struct`. Its fields hold the schema's **encoded values**, the values an input edits. Its handler receives **decoded values**, the domain values produced by Schema. For `Schema.NumberFromString`, that means a field holds `"350"` and the handler receives `350`.

The **baseline** is the encoded value against which the form recognizes edits. It starts with `initialValues`, moves when the form receives server values, and normally moves to a successful submission's encoded snapshot. A **submission** captures the encoded values before decoding and saving. Editing can continue afterwards; those later edits are separate from that submission.

Keep one form instance for one editing session. Use a new instance for a different entity or user session. Query acquisition, entity identity, normalized saved rows and create-reset orchestration can be composed with [`useEditor` and `useCreate`](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/README.md) from `@shivaedev/effect-react`.

### Once per application: supply the runtime and registry

`make` takes an atom runtime. Build its Layer from the services your submit handler and field checks need. A handler that reads a service outside that runtime's declared dependencies does not compile. The handler's type also permits the native `Scope`, `AtomRegistry` and `Reactivity` services.

Use an `AtomRegistry` to mount and read atoms and write the submit atom. Own its lifetime at the application boundary. In React, provide that registry through `RegistryContext` from `@effect/atom-react`.

### Once per feature: define fields and submission

```ts
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { make } from "@shivaedev/effect-form/form.ts";

const runtime = Atom.runtime(Layer.empty);
const fields = Schema.Struct({
  name: Schema.NonEmptyString,
  quantity: Schema.NumberFromString,
});

const order = make(fields, {
  initialValues: { name: "Paper", quantity: "300" },
  onSubmit: (values, submitter) =>
    values.name === "reserved"
      ? submitter.fail("name", "Choose another name")
      : Effect.succeed(values),
  runtime,
});

const registry = AtomRegistry.make();
const release = registry.mount(order.dirty);

try {
  order.change("quantity", "350");
  registry.set(order.submit, undefined);
  const saved = await Effect.runPromise(
    AtomRegistry.getResult(registry, order.submit, { suspendOnWaiting: true }),
  );
  console.log(saved);
} finally {
  release();
  registry.dispose();
}
```

The input quantity is a string; the successful result contains quantity `350`. Invalid input fails with `Invalid` before `onSubmit` runs. The handler can fail a named field with `submitter.fail`; changing that field clears the rejection, and another submission uses the new input.

The handler has three arguments: decoded values, the submitter, and the submitted encoded snapshot. Use the third argument when coordinating work against what was submitted, rather than reading live fields after an asynchronous decode. The `effect-react` create adapter uses that snapshot to preserve input typed while decoding.

### In the UI: bind the same form

```tsx
import { RegistryContext } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { make } from "@shivaedev/effect-form/form.ts";
import { useDirty, useField, useSubmit } from "@shivaedev/effect-form/react.ts";

const runtime = Atom.runtime(Layer.empty);
const fields = Schema.Struct({ name: Schema.NonEmptyString, quantity: Schema.NumberFromString });

function OrderEditor() {
  const [form] = useState(() => make(fields, {
    initialValues: { name: "Paper", quantity: "300" },
    onSubmit: Effect.succeed,
    runtime,
  }));
  const name = useField(form, "name");
  const quantity = useField(form, "quantity");
  const submit = useSubmit(form);
  const dirty = useDirty(form);

  return <form onSubmit={(event) => {
    event.preventDefault();
    if (!submit.submitting) submit.run();
  }}>
    <label>Name <input value={name.value} onBlur={name.onBlur}
      onChange={(event) => name.onChange(event.target.value)} /></label>
    {name.error && <p role="alert">{name.error}</p>}
    <label>Quantity <input value={quantity.value} onBlur={quantity.onBlur}
      onChange={(event) => quantity.onChange(event.target.value)} /></label>
    {quantity.error && <p role="alert">{quantity.error}</p>}
    <button disabled={submit.submitting}>Save</button>
    <button type="button" onClick={form.revert}>Revert</button>
    <p role="status">{submit.submitting ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</p>
  </form>;
}

export function mountOrderEditor(container: HTMLElement) {
  const registry = AtomRegistry.make();
  const root = createRoot(container);
  root.render(<RegistryContext.Provider value={registry}><OrderEditor /></RegistryContext.Provider>);
  return () => {
    root.unmount();
    registry.dispose();
  };
}
```

`useState` creates the form once for this component's editing session. `useField` supplies encoded values and change/blur callbacks; `useSubmit` supplies the native result, a submit callback and waiting state; `useDirty` reads whether edits remain. The mount function supplies a registry and returns its cleanup.

Render general submission failures from `submit.result` in the application's own words. A field rejection and schema failure are available there too; showing a field message does not replace handling the whole result.

### Receive server values without losing edits

Call `receive` with encoded values from a refreshed or saved row. Encode domain values before receiving them; for a numeric string field, receive `String(row.quantity)`.

| Situation | What the form does |
| --- | --- |
| A field still equals its baseline | Receives the new value. |
| A field was edited locally | Keeps that input; received values become the new baseline. |
| A refresh omits an untouched optional key | Removes the key. |
| An optional key was added locally | Keeps it when a refresh omits it; revert restores the received values. |
| The handler succeeds | Accepts the submitted encoded values without replacing later edits. |
| A refresh arrived during a successful save | Keeps that refresh as the baseline; values still equal to the accepted submission count as saved and adopt the next refresh. |
| The handler fails | Keeps input; an intervening refresh remains the baseline. |
| `revert()` is called | Restores the latest baseline, including omitted optional keys. |

The form does not replace submitted encoded input with its decoded representation. A trimmed name can be accepted as saved while the input still contains its spaces. Receive the normalized saved row when the application wants that representation on screen. `useEditor` from `effect-react` performs that composition.

### Persist input across reloads

Opt in with `persistedDraft`. The application chooses a key for one logical editing session. Keep that key stable across server revisions so a refresh can find the same draft; choose a new key when the encoded field shape changes. Stored input includes its baseline and edited field names, so edited fields survive reload while untouched fields adopt the latest received values.

For a core form, supply the storage provider explicitly:

```ts
const order = make(fields, {
  initialValues: { name: "Paper", quantity: "300" },
  onSubmit: Effect.succeed,
  persistedDraft: { key: "order:123", storage: () => window.localStorage },
  runtime,
});
```

For a React form, call `usePersistedDraft` before creating the form. It defaults to browser `localStorage` and attaches the current `SessionBoundary` draft owner:

```tsx
import { useState } from "react";
import { usePersistedDraft } from "@shivaedev/effect-form/react.ts";

function OrderEditor() {
  const persistedDraft = usePersistedDraft({ key: "order:123" });
  const [form] = useState(() => make(fields, {
    initialValues: { name: "Paper", quantity: "300" },
    onSubmit: Effect.succeed,
    persistedDraft,
    runtime,
  }));
  return <OrderFields form={form} />;
}
```

`OrderFields` is the application's field UI. Keep this component mounted for one record; remount it when its identity changes. `useEditor` and `useCreate` from `effect-react` accept `persistedDraft: { key }` directly and attach the same owner. A committed `SessionBoundary` session replacement or sign-out drops its tracked drafts, including screens already unmounted, and disables writes from its old forms. A suspended replacement that is canceled preserves the visible session's stored draft and future persistence. Ordinary unmounts and React effect replay preserve stored drafts. A stored draft with a different session generation is discarded when read.

Each stored record defaults to at most 256 KiB of UTF-8 JSON and seven days since its last write. Set `maxBytes` and `maxAgeMs` to finite positive limits to change those bounds. Oversized, expired, malformed or incompatible records are dropped when encountered. Persistence requires JSON-compatible encoded input; invalid input such as an empty required string or an unfinished numeric string still persists. Storage access, serialization and quota failures leave the form usable.

Edits and received values update the stored draft. Revert removes it. A successful submit clears accepted input; edits made after the submitted snapshot remain persisted. A failed submit keeps the draft.

Outside React, pass a `session` from `draftSession(id)` in `@shivaedev/effect-form/draftSession.ts` and call its `drop()` when the application replaces that session. Core forms without a session owner use only the application's key. `DraftSessionContext` supplies the owner to React integrations.

### Field feedback and advisory checks

An untouched invalid field initially has no visible message. Invalid submission reveals schema messages, and editing a field updates its feedback. A server rejection clears on an edit; a rejection that arrives after the field has changed does not attach to the new value.

For `Schema.NonEmptyString`, an empty input's message is `Required`. Longer minimum-length checks retain Schema's message.

```ts
const profile = make(Schema.Struct({ name: Schema.String }), {
  checks: {
    name: (value) => Effect.succeed(value === "taken" ? "Name is taken" : undefined),
  },
  debounce: "300 millis",
  initialValues: { name: "" },
  onSubmit: Effect.succeed,
  runtime,
});
```

This check produces advisory feedback after the configured debounce and completion. A message is shown only while its checked input is still the current field value. Pending checks, older results and a defective check do not show an earlier value's message. Checks can read services from the supplied runtime. Keep authoritative validation in the schema or handler.

For a nested value held in one top-level field, `errorAt(["answers", index, "text"])` reads Schema feedback and handler rejections for that answer box. A blur or change of the top-level `answers` field, or a submission, reveals its nested messages. The path selects the first message at or beneath that path; a sibling message does not appear there. `error("answers")` retains the top-level summary. Advisory checks remain top-level. Nested values are still edited as a whole top-level field.

### Errors on array elements

Pass a path tuple to `submitter.fail` to reject one element or a property inside it. Paths use indices in the submitted encoded snapshot. Optional `arrayKeys` selectors receive encoded elements of top-level array fields and return their stable, unique keys:

```ts
const answers = make(Schema.Struct({
  answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })),
}), {
  arrayKeys: { answers: answer => answer.id },
  initialValues: { answers: [{ id: "question", text: "Yes" }] },
  onSubmit: (_values, submitter) =>
    submitter.fail(["answers", 0, "text"], "This answer is closed"),
  runtime,
});
```

`FieldFailure.path` keeps the top-level field name as a string. For a tuple rejection, optional `FieldFailure.segments` contains its submitted path.

Read the message at the element's **current** index: in React, `useAtomValue(answers.errorAt(["answers", index, "text"]))` from `@effect/atom-react` renders it beside that answer. Schema messages update from current values. Keyed handler rejections follow insertion, removal and reorder, even when elements are recreated, and a late rejection follows its submitted key to the current index. Editing the rejected input or removing its element discards the rejection; editing a sibling or blurring the array preserves it. Duplicate keys cannot identify an element and discard its rejection.

Without a selector for an array, handler errors fall back to index paths. They remain at that index while its input value matches, even if a different element with the same value moves there. Arrays nested inside an element also use index paths. Use immutable value updates and stable, unique keys for top-level arrays whose errors must follow elements.

### Choices and nullable inputs

```ts
import { Schema } from "effect";
import { emptyAsNull } from "@shivaedev/effect-form/optional.ts";

const fields = Schema.Struct({
  visibility: Schema.Literals(["private", "public"]),
  quantity: emptyAsNull(Schema.NumberFromString),
});
```

For a form made with these fields, `form.choices("visibility")` returns the encoded literals `"private"` and `"public"`. Choices also stay encoded when the field's codec transforms those literals. `emptyAsNull` decodes `""` to `null` and uses the inner codec for populated input; encoding `null` gives `""`.

### API

Import the module that defines a name; there is no root entry.

| Module | Application-facing exports |
| --- | --- |
| `@shivaedev/effect-form/form.ts` | `make(schema, config)` |
| `@shivaedev/effect-form/shape.ts` | `Fields`, `Name`, `ArrayKeys`, `Path`, `Encoded`, `Decoded`, `Services`, `Checks`, `Config`, `Form`, `Submitter`, `FieldFailure`, `Invalid` |
| `@shivaedev/effect-form/react.ts` | `useField`, `useSubmit`, `useDirty`, `usePersistedDraft`, `DraftSessionContext`, `BrowserDraftConfig`, `Field`, `Submit` |
| `@shivaedev/effect-form/persistence.ts` | `PersistedDraftConfig`, `DraftStorage`; `persistence` and `Persistence` for composing storage machinery |
| `@shivaedev/effect-form/draftSession.ts` | `draftSession(id)`, `DraftSession` |
| `@shivaedev/effect-form/paths.ts` | `KeySelectors`, `PathMessage`, `keySelector`, `asPath`, `retainedPath`, `pathMessageAt` |
| `@shivaedev/effect-form/trackRejections.ts` | `trackRejections(values, selectors, status)`, composing submitted-path rejection tracking with value changes |
| `@shivaedev/effect-form/optional.ts` | `emptyAsNull` |
| `@shivaedev/effect-form/messages.ts` | `FieldMessages`, `messagesByField`, `messageAt`, `messageAtPath`, `schemaFeedback`, `withoutField`, `literalChoices`, `noMessages` |

`make` takes a `Schema.Struct` and this configuration:

| Option | Type or role |
| --- | --- |
| `initialValues` | `Encoded<F>` |
| `runtime` | Atom runtime for the handler/check services and schema decoding services |
| `onSubmit` | `(values, submitter, submitted) => Effect<A, E, R>`; the three arguments are decoded values, field failure helper and encoded snapshot |
| `checks` | Optional functions keyed by field, from encoded input to an Effect of `string \| undefined` |
| `arrayKeys` | Optional `ArrayKeys<F>` selectors keyed by top-level array field, from encoded element to stable `PropertyKey`; retains nested feedback across reordering |
| `debounce` | Optional Effect `Duration.Input` for checks |
| `persistedDraft` | Optional `{ key, storage, maxBytes?, maxAgeMs?, session? }`; React's `usePersistedDraft` supplies storage and session ownership |

The returned form exposes:

| Member | Type or use |
| --- | --- |
| `values` | `AtomRef<Encoded<F>>` for the whole input |
| `field(name)` | `AtomRef<Encoded<F>[K]>` for a field |
| `change(name, value)` | Write encoded input through the form's editing operation |
| `blur(name)` | Field blur operation, supplied as `useField(...).onBlur` |
| `error(name)` | Atom of `string \| undefined` |
| `errorAt([name, ...path])` | Atom of nested Schema feedback and handler rejections; visibility follows the top-level field |
| `choices(name)` | Encoded choices or `undefined` |
| `dirty` | Atom of `boolean` |
| `receive(values)` | Merge received encoded values |
| `revert()` | Restore the baseline |
| `submit` | `AtomResultFn<void, A, E \| ER \| FieldFailure \| Invalid>` |
| `submitting` | Atom of `boolean` for submission waiting state |

`F` is the schema's fields, `A` and `E` are the handler's success and failure types, and `ER` is the atom runtime's failure type. `FieldFailure` contains the top-level string `path`, `message` and optional submitted path `segments`; `Invalid` contains `messages`, a `FieldMessages` record.

`useField(form, name)` returns `name`, `value`, `error`, `choices`, `onChange(value)` and `onBlur()`. `useSubmit(form)` returns `result`, `run()` and `submitting`. `useDirty(form)` returns a boolean.

The explicit module exports also expose `draft.ts` (`draft`), `refs.ts` (`fromRef`, `propertyRef`), `status.ts` (`statusOf`), and the conversion helpers `Holder`, `holder`, `fieldOf`, `choicesOf` and `checkOf` in `shape.ts`. The examples use the form API instead of composing that machinery directly.

### Install and limits

```sh
pnpm add @shivaedev/effect-form effect@4.0.4
```

For React bindings:

```sh
pnpm add @effect/atom-react@4.0.4 react@19.3.0
```

The React mounting example also uses the application's `react-dom`. React and `@effect/atom-react` are optional peers; the core modules do not import them. The manifest requires Node 24 or newer. The repository's peer catalog uses Effect and atom-react `4.0.4` and React `19.3.0`.

- Field names are top-level schema keys. There is no path-addressed field-array API.
- Replace encoded values rather than mutating objects in place; use `change` for ordinary UI edits.
- Keep the form and registry for their intended session, and clean up the registry when that session ends.
- Decide in the application when to receive normalized rows and how to render general failures. Attach a draft owner when persisted input must end with the session.
- The package and composed DOM/HTTP fixtures do not establish application adoption, SSR isolation or mobile lifecycle behavior.
