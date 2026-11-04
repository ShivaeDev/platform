# @shivaedev/form

Keep input values, decoded submissions and fresh server data in one form. Define fields with Effect Schema, submit domain values, and preserve local edits when a refresh or save finishes.

## Why you want this

An input gives you a string; your service needs a number. Meanwhile, fresh server data can arrive beside an unsaved edit. Repeating those conversions and merge rules in components makes every form another state machine. Here, the schema owns the conversion and the form owns the editing session:

```ts
const order = form(Schema.Struct({ name: Schema.String, quantity: Schema.NumberFromString }), {
	initialValues: { name: "Paper", quantity: "300" },
	onSubmit: Effect.succeed,
});

order.change("name", "Copy paper");
order.receive({ name: "Paper", quantity: "350" });
```

The name stays `"Copy paper"`; the untouched quantity becomes `"350"`. Submitting gives the handler quantity `350`, a number. The same form can be used through native atoms or small React hooks, so the component does not need another draft model.

## Using it

### How to think about it

A form is one **editing session** over a `Schema.Struct`. Its fields hold the schema's **encoded values**, the values an input edits. Its handler receives **decoded values**, the domain values produced by Schema. For `Schema.NumberFromString`, that means a field holds `"350"` and the handler receives `350`.

The **baseline** is the encoded value against which the form recognizes edits. It starts with `initialValues`, moves when the form receives server values, and normally moves to a successful submission's encoded snapshot. A **submission** captures the encoded values before decoding and saving. Editing can continue afterwards; those later edits are separate from that submission.

Keep one form instance for one editing session. Use a new instance for a different entity or user session. Query acquisition, entity identity, normalized saved rows and create-reset orchestration can be composed with [`useEditor` and `useCreate`](https://github.com/ShivaeDev/platform/blob/main/packages/react/README.md) from `@shivaedev/react`.

### Once per application: supply services and a registry

`form` uses an empty atom runtime when the handler, field checks and schema decoding need no application services. To use application services, pass `runtime: Atom.runtime(layer)` with a Layer that provides them. Missing service dependencies fail to compile. The native `Scope`, `AtomRegistry` and `Reactivity` services are available without a supplied runtime.

Use an `AtomRegistry` to mount and read atoms and write the submit atom. Own its lifetime at the application boundary. In React, provide that registry through `RegistryContext` from `@effect/atom-react`.

### Once per feature: define fields and submission

```ts
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { form } from "@shivaedev/form/form.ts";

const fields = Schema.Struct({
	name: Schema.NonEmptyString,
	quantity: Schema.NumberFromString,
});

const order = form(fields, {
	initialValues: { name: "Paper", quantity: "300" },
	onSubmit: (values, submitter) => (values.name === "reserved" ? submitter.fail("name", "Choose another name") : Effect.succeed(values)),
});

const registry = AtomRegistry.make();
const release = registry.mount(order.dirty);

try {
	order.change("quantity", "350");
	registry.set(order.submit, undefined);
	const saved = await Effect.runPromise(AtomRegistry.getResult(registry, order.submit, { suspendOnWaiting: true }));
	console.log(saved);
} finally {
	release();
	registry.dispose();
}
```

The input quantity is a string; the successful result contains quantity `350`. Invalid input fails with `Invalid` before `onSubmit` runs. The handler can fail a named field with `submitter.fail`; changing that field clears the rejection, and another submission uses the new input.

Set `requiredMessages` to give a top-level string field its own wording while keeping `Schema.NonEmptyString`:

```ts
const order = form(fields, {
	initialValues: { name: "", quantity: "300" },
	onSubmit: Effect.succeed,
	requiredMessages: { name: "Enter the order name" },
});
```

An empty name shows that message after blur or submission, including through `errorAt(["name"])` and `Invalid.messages`. Entering a name clears it. Explicit schema messages take precedence; longer minimum lengths keep their validation message. Fields without a configured message keep the default `"Required"`.

The handler has three arguments: decoded values, the submitter, and the submitted encoded snapshot. Use the third argument when coordinating work against what was submitted, rather than reading live fields after an asynchronous decode. The `react` create adapter uses that snapshot to preserve input typed while decoding.

### Validate without saving

Write the `validate` atom to reveal validation for every field and whole-form refinement without calling `onSubmit`:

```ts
registry.set(order.validate, undefined);
const snapshot = await Effect.runPromise(AtomRegistry.getResult(registry, order.validate, { suspendOnWaiting: true }));
```

The result is a `Snapshot<F>` with `encoded` input captured before decoding and `decoded` domain values. Validation uses the form's runtime, including asynchronous and service-based decoding. Invalid input fails with `Invalid`, carrying the same field and whole-form feedback as submit. Validation leaves the input, dirty baseline and persisted draft intact; it does not save or accept changes.

### In the UI: bind the same form

```tsx
import { RegistryContext } from "@effect/atom-react";
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { form } from "@shivaedev/form/form.ts";
import { useDirty, useField, useSubmit } from "@shivaedev/form/adapters/react.ts";

const fields = Schema.Struct({ name: Schema.NonEmptyString, quantity: Schema.NumberFromString });

function OrderEditor() {
	const [order] = useState(() =>
		form(fields, {
			initialValues: { name: "Paper", quantity: "300" },
			onSubmit: Effect.succeed,
		}),
	);
	const name = useField(order, "name");
	const quantity = useField(order, "quantity");
	const submit = useSubmit(order);
	const dirty = useDirty(order);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (!submit.submitting) submit.run();
			}}
		>
			<label>
				Name <input value={name.value} onBlur={name.onBlur} onChange={(event) => name.onChange(event.target.value)} />
			</label>
			{name.error && <p role="alert">{name.error}</p>}
			<label>
				Quantity <input value={quantity.value} onBlur={quantity.onBlur} onChange={(event) => quantity.onChange(event.target.value)} />
			</label>
			{quantity.error && <p role="alert">{quantity.error}</p>}
			<button disabled={submit.submitting}>Save</button>
			<button type="button" onClick={order.revert}>
				Revert
			</button>
			<p role="status">{submit.submitting ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</p>
		</form>
	);
}

export function mountOrderEditor(container: HTMLElement) {
	const registry = AtomRegistry.make();
	const root = createRoot(container);
	root.render(
		<RegistryContext.Provider value={registry}>
			<OrderEditor />
		</RegistryContext.Provider>,
	);
	return () => {
		root.unmount();
		registry.dispose();
	};
}
```

`useState` creates the form once for this component's editing session. `useField` supplies the field's name, encoded value, `error`, `choices` and change/blur callbacks; `useSubmit` supplies the native result, a submit callback and waiting state; `useDirty` reads whether edits remain. The mount function supplies a registry and returns its cleanup.

Render general submission failures from `submit.result` in the application's own words. A field rejection and schema failure are available there too; showing a field message does not replace handling the whole result.

### Receive server values without losing edits

Call `receive` with encoded values from a refreshed or saved row. Encode domain values before receiving them; for a numeric string field, receive `String(row.quantity)`.

| Situation                                  | What the form does                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| A field still equals its baseline          | Receives the new value.                                                                                                      |
| A field was edited locally                 | Keeps that input; received values become the new baseline.                                                                   |
| A refresh omits an untouched optional key  | Removes the key.                                                                                                             |
| An optional key was added locally          | Keeps it when a refresh omits it; revert restores the received values.                                                       |
| The handler succeeds                       | Accepts the submitted encoded values without replacing later edits.                                                          |
| A refresh arrived during a successful save | Keeps that refresh as the baseline; values still equal to the accepted submission count as saved and adopt the next refresh. |
| The handler fails                          | Keeps input; an intervening refresh remains the baseline.                                                                    |
| `revert()` is called                       | Restores the latest baseline, including omitted optional keys.                                                               |

By default, the form does not replace submitted encoded input with its decoded representation. A trimmed name can be accepted as saved while the input still contains its spaces. Set `savedValues: (saved) => encodedValues` to display normalized values from the successful handler result. Fields changed since submission keep their input; other fields adopt the normalized values. If a refresh arrived during the save, its newer baseline stays in place and the saved mapping does not replace it. `useEditor` from `react` supplies this mapping from its `values` callback.

### Persist input across reloads

Opt in with `persistedDraft`. The application chooses a key for one logical editing session. Keep that key stable across server revisions so a refresh can find the same draft; choose a new key when the encoded field shape changes. Stored input includes its baseline and edited field names, so edited fields survive reload while untouched fields adopt the latest received values.

Acquire draft persistence during the application's Effect setup. `draftPersistence` reads `DraftStorageProvider` and `Clock.Clock` from the environment, returning the storage provider and a callback that reads that clock for every timestamp and expiry check. The browser adapter supplies `localStorage`; storage lookup stays lazy so a browser refusal remains best-effort. Supply a different provider with `Layer.succeed(DraftStorageProvider, () => storage)`.

```ts
import { Effect } from "effect";
import { browserDraftStorage } from "@shivaedev/form/adapters/browserDraftStorage.ts";
import { draftPersistence } from "@shivaedev/form/adapters/draftPersistence.ts";

const persistence = yield* draftPersistence.pipe(Effect.provide(browserDraftStorage));
const order = form(fields, {
 initialValues: { name: "Paper", quantity: "300" },
 onSubmit: Effect.succeed,
 persistedDraft: { key: "order:123", ...persistence },
});
```

For a React form, pass the acquired persistence into `usePersistedDraft` before creating the form. The hook attaches the current `SessionBoundary` draft owner:

```tsx
import { useState } from "react";
import { usePersistedDraft } from "@shivaedev/form/adapters/react.ts";
import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";

function OrderEditor({ persistence }: { readonly persistence: Omit<PersistedDraftConfig, "key"> }) {
	const persistedDraft = usePersistedDraft({ key: "order:123", ...persistence });
	const [order] = useState(() =>
		form(fields, {
			initialValues: { name: "Paper", quantity: "300" },
			onSubmit: Effect.succeed,
			persistedDraft,
		}),
	);
	return <OrderFields form={order} />;
}
```

`OrderFields` is the application's field UI. Keep this component mounted for one record; remount it when its identity changes. `useEditor` and `useCreate` from `react` accept `persistedDraft: { key, ...persistence }` directly and attach the same owner. A committed `SessionBoundary` session replacement or sign-out drops its tracked drafts, including screens already unmounted, and disables writes from its old forms. A suspended replacement that is canceled preserves the visible session's stored draft and future persistence. Ordinary unmounts and React effect replay preserve stored drafts. A stored draft with a different session generation is discarded when read.

Each stored record defaults to at most 256 KiB of UTF-8 JSON and seven days since its last write. Set `maxBytes` and `maxAgeMs` to finite positive limits to change those bounds. Oversized, expired, malformed or incompatible records are dropped when encountered. Persistence requires JSON-compatible encoded input; invalid input such as an empty required string or an unfinished numeric string still persists. Storage access, serialization and quota failures leave the form usable.

Edits and received values update the stored draft. Revert conditionally removes the form's owned revision. A successful submit clears only the revision associated with its submitted input, including refreshes of its untouched fields; newer edits made locally or in another editor remain persisted. A failed submit keeps the draft.

A custom `DraftStorage` implements `getItem(key)`, `setItem(key, value, expected?)` and `removeItem(key, expected)`. Each operation returns its synchronous result or a native `Effect` with no remaining services; acquire application services when constructing the provider. `expected` is the exact serialized value previously read or written, containing an opaque revision. The storage owner must compare and mutate atomically: remove the key, or replace it when `setItem` supplies `expected`, only if its current value equals `expected`. A `setItem` without `expected` stores a new local edit; a conditional write rebases accepted or refreshed fields without replacing another editor's newer draft. For an Electron bridge, perform these comparisons in the process that owns the shared store. Writes and clears from one form run in order even when storage is asynchronous. Storage failures remain best-effort and do not fail the form's save.

Optional `subscribe(key, listener)` reports the current serialized value, or `null` when cleared, and returns an unsubscribe function. Report changes in storage order. Observation starts while the form's atoms are mounted and ends with their lifetime. Form's React hooks mount that lifetime automatically; direct atom consumers mount `form.dirty` or its validation/submission atoms. An untouched editor follows observed changes. Locally edited fields keep their current input while untouched fields adopt the observed draft. Receiving a storage event does not echo a write. The browser adapter observes other windows through storage events and serializes mutations with Web Locks where available; without Web Locks its compare and remove run synchronously.

Outside React, pass a `session` from `draftSession(id)` in `@shivaedev/form/draftSession.ts` and call its `drop()` when the application replaces that session. Core forms without a session owner use only the application's key. `DraftSessionContext` supplies the owner to React integrations.

### Field feedback and advisory checks

An untouched invalid field initially has no visible message. Invalid submission reveals schema messages, and editing a field updates its feedback. A server rejection clears on an edit; a rejection that arrives after the field has changed does not attach to the new value.

For `Schema.NonEmptyString`, an empty input's message is `Required`. Longer minimum-length checks retain Schema's message.

```ts
const profile = form(Schema.Struct({ name: Schema.String }), {
	checks: {
		name: (value) => Effect.succeed(value === "taken" ? "Name is taken" : undefined),
	},
	debounce: "300 millis",
	initialValues: { name: "" },
	onSubmit: Effect.succeed,
});
```

This check produces advisory feedback after the configured debounce and completion. A message is shown only while its checked input is still the current field value. Pending checks, older results and a defective check do not show an earlier value's message. Checks can read services from the supplied runtime. Keep authoritative validation in the schema or handler.

For a nested value held in one top-level field, `errorAt(["answers", index, "text"])` reads Schema feedback and handler rejections for that answer box. A blur or change of the top-level `answers` field, or a submission, reveals its nested messages. The path selects the first message at or beneath that path; a sibling message does not appear there. `error("answers")` retains the top-level summary. Advisory checks remain top-level. Use typed nested paths to edit individual members.

`fieldAt(["energy", "low"])` returns an encoded-value ref for a nested member. `changeAt(["energy", "low"], "12")` edits that member immutably, preserves its siblings and touches the top-level group for feedback. The schema still decodes the complete struct on submission. Receive, save and revert keep their existing top-level baseline semantics; nested fields do not create separate sessions.

React inputs use `useFieldAt` with the same typed path:

```ts
import { useFieldAt } from "@shivaedev/form/adapters/useFieldAt.ts";

const low = useFieldAt(foodForm, ["energy", "low"]);
```

Like `useField`, this returns `value`, `onChange`, `onBlur` and `error`. Its `name` joins the path with dots, such as `energy.low`, and its feedback comes from `errorAt`. The encoded field type determines what `onChange` accepts.

Whole-form Schema refinements are available through `errorAt([])` after submission. This root path selects only a whole-form message; field errors stay on their field paths. In React, render it with `useAtomValue(form.errorAt([]))`. A failed submission also keeps that message in `Invalid.formMessage`. Matching the refinement clears the feedback. Schema feedback is hidden while a new asynchronous decode is pending.

### Map save rejections to fields

`rejecting` from `@shivaedev/form/fieldRejection.ts` wraps a save with field feedback. It takes the form schema, the save function and a `rejectField` callback or `undefined`. With `undefined`, `fieldRejectionOf(schema)` uses `@shivaedev/errors` to recognize tagged string-field rejections and selects names in that schema. Other failures keep their original error.

For a service whose rejection names a nested value, return a path tuple from the callback:

```ts
import { rejecting } from "@shivaedev/form/fieldRejection.ts";

const profile = form(Profile, {
	initialValues: { profile: { email: "alice@example.com", name: "Taken" } },
	onSubmit: rejecting(Profile, saveProfile, (error) =>
		error.field === "name" ? { field: ["profile", "name"] as const, message: error.message } : undefined,
	),
});
```

`Profile` is the application's struct with a nested `profile` value, and `saveProfile` is its Effect save function. The mapped message appears at `errorAt(["profile", "name"])`; the email sibling stays clear. Returning `undefined` leaves the save failure unchanged.

### Errors on array elements

Pass a path tuple to `submitter.fail` to reject one element or a property inside it. Paths use indices in the submitted encoded snapshot. Optional `arrayKeys` selectors receive encoded elements of top-level array fields and return their stable, unique keys:

```ts
const answers = form(
	Schema.Struct({
		answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.NonEmptyString })),
	}),
	{
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [{ id: "question", text: "Yes" }] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "text"], "This answer is closed"),
	},
);
```

`FieldFailure.path` keeps the top-level field name as a string. For a tuple rejection, optional `FieldFailure.segments` contains its submitted path.

Read the message at the element's **current** index: in React, `useAtomValue(answers.errorAt(["answers", index, "text"]))` from `@effect/atom-react` renders it beside that answer. Schema messages update from current values. Keyed handler rejections follow insertion, removal and reorder, even when elements are recreated, and a late rejection follows its submitted key to the current index. Editing the rejected input or removing its element discards the rejection; editing a sibling or blurring the array preserves it. Duplicate keys cannot identify an element and discard its rejection.

Without a selector for an array, handler errors fall back to index paths. They remain at that index while its input value matches, even if a different element with the same value moves there. Arrays nested inside an element also use index paths. Use immutable value updates and stable, unique keys for top-level arrays whose errors must follow elements.

### Numeric inputs

```tsx
import * as Field from "@shivaedev/form/field.ts";
import { numberInput } from "@shivaedev/form/adapters/numberInput.ts";
import { useField } from "@shivaedev/form/adapters/react.ts";

const numbers = form(Schema.Struct({ amount: Field.number({ optional: true, min: 0, max: 100, integer: true }) }), {
	initialValues: { amount: "" },
	onSubmit: Effect.succeed,
});

function Amount() {
	const amount = useField(numbers, "amount");
	return (
		<>
			<input {...numberInput(amount)} />
			<span role="alert">{amount.error}</span>
		</>
	);
}
```

`Field.number` holds a string and decodes to a finite number. `optional: true` decodes empty or whitespace-only input to `null`; encoding `null` gives `""`. Without it, blank input is required. `min` and `max` are inclusive; `integer: true` rejects fractions. Omit `integer` to accept fractions and omit either bound for an open range. Invalid, non-finite and out-of-range values prevent submission.

`numberInput(field)` supplies `name`, `value`, `onInput`, `onBlur`, `type: "text"` and `inputMode: "decimal"` for a string-valued field. A text input preserves invalid text so it can display Schema feedback; a native number input can erase that text before the form receives it. Wording and layout remain application choices.

### Bounded lists

```tsx
import * as Field from "@shivaedev/form/field.ts";
import { useList } from "@shivaedev/form/adapters/useList.ts";

const quickAmounts = form(Schema.Struct({ amounts: Field.list(Field.number({ min: 1 }), { max: 5 }) }), {
	initialValues: { amounts: ["1", "2"] },
	onSubmit: Effect.succeed,
});

function QuickAmounts() {
	const amounts = useList(quickAmounts, "amounts");
	return (
		<>
			{amounts.items.map((item, index) => (
				<div key={index}>
					<input {...numberInput({ name: String(index), value: item.value, onChange: item.onChange, onBlur: amounts.onBlur })} />
					<span role="alert">{item.error}</span>
					<button type="button" onClick={item.onRemove}>
						Remove
					</button>
				</div>
			))}
			<button type="button" onClick={() => amounts.add("")}>
				Add amount
			</button>
			<span role="alert">{amounts.error}</span>
		</>
	);
}
```

`Field.list(item, { max, min? })` returns a native array schema with a required maximum count and optional minimum count. An omitted minimum permits an empty list. Bounds validate the current array, including direct edits: adding beyond `max` or removing below `min` displays list feedback and prevents submission. The binding keeps the edit available for correction.

`useList(form, name)` edits a top-level array field through the existing form session. `add(encodedItem)` appends an item; each entry of `items` exposes its encoded `value`, `onChange(encodedItem)`, `onRemove()` and `error`. `onBlur()` touches the list. Item errors use `errorAt([name, index])`, and `error` retains the list summary. Schema errors track current positions. For object items, supply stable keys through `arrayKeys` and use the same keys in React; handler rejections then follow the existing keyed-array rules described above. Nested objects remain whole-item edits.

### Choices and nullable inputs

```ts
import { Schema } from "effect";
import { emptyAsNull } from "@shivaedev/form/emptyAsNull.ts";

const fields = Schema.Struct({
	visibility: Schema.Literals(["private", "public"]),
	quantity: emptyAsNull(Schema.NumberFromString),
});
```

For a form made with these fields, `order.choices("visibility")` returns the encoded literals `"private"` and `"public"`. Choices also stay encoded when the field's codec transforms those literals. `emptyAsNull` decodes `""` to `null` and uses the inner codec for populated input; encoding `null` gives `""`.

### API

Import the module that defines a name; there is no root entry.

| Module                                    | Application-facing exports                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@shivaedev/form/form.ts`                 | `form(schema, config)`                                                                    |
| `@shivaedev/form/shape.ts`                | `Form`, `Submitter`, `FieldFailure`, `Invalid` and the field types they use               |
| `@shivaedev/form/fieldRejection.ts`       | `rejecting`, `fieldRejectionOf`, `FieldRejection`, `RejectField`, `FieldRejectionMapping` |
| `@shivaedev/form/adapters/react.ts`       | `useField`, `useSubmit`, `useDirty`, `usePersistedDraft`, `DraftSessionContext`           |
| `@shivaedev/form/draftSession.ts`         | `draftSession(id)`                                                                        |
| `@shivaedev/form/field.ts`                | `number`, `list`, `NumberOptions`, `ListOptions`                                          |
| `@shivaedev/form/adapters/numberInput.ts` | `numberInput`                                                                             |
| `@shivaedev/form/adapters/useList.ts`     | `useList`                                                                                 |
| `@shivaedev/form/emptyAsNull.ts`          | `emptyAsNull`                                                                             |

`form` takes a `Schema.Struct` and this configuration:

| Option           | Type or role                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialValues`  | `Encoded<F>`                                                                                                                                              |
| `runtime`        | Optional when no application services are needed; otherwise an atom runtime for handler/check and schema decoding services                                |
| `onSubmit`       | `(values, submitter, submitted) => Effect<A, E, R>`; the three arguments are decoded values, field failure helper and encoded snapshot                    |
| `savedValues`    | Optional `(saved: A) => Encoded<F>`; normalizes successful submissions while preserving later edits and newer received baselines                          |
| `checks`         | Optional functions keyed by field, from encoded input to an Effect of `string \| undefined`                                                               |
| `arrayKeys`      | Optional `ArrayKeys<F>` selectors keyed by top-level array field, from encoded element to stable `PropertyKey`; retains nested feedback across reordering |
| `debounce`       | Optional Effect `Duration.Input` for checks                                                                                                               |
| `persistedDraft` | Optional `{ key, now, storage, maxBytes?, maxAgeMs?, session? }`; React's `usePersistedDraft` supplies session ownership                                  |

The returned form exposes:

| Member                     | Type or use                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `values`                   | `AtomRef<Encoded<F>>` for the whole input                                                     |
| `field(name)`              | `AtomRef<Encoded<F>[K]>` for a field                                                          |
| `change(name, value)`      | Write encoded input through the form's editing operation                                      |
| `blur(name)`               | Field blur operation, supplied as `useField(...).onBlur`                                      |
| `error(name)`              | Atom of `string \| undefined`                                                                 |
| `errorAt([name, ...path])` | Atom of nested Schema feedback and handler rejections; visibility follows the top-level field |
| `errorAt([])`              | Atom of whole-form Schema feedback, visible after validation or submission                    |
| `choices(name)`            | Encoded choices or `undefined`                                                                |
| `dirty`                    | Atom of `boolean`                                                                             |
| `receive(values)`          | Merge received encoded values                                                                 |
| `revert()`                 | Restore the baseline                                                                          |
| `validate`                 | `AtomResultFn<void, Snapshot<F>, ER \| Invalid>`; reveal feedback and decode without saving   |
| `submit`                   | `AtomResultFn<void, A, E \| ER \| FieldFailure \| Invalid>`                                   |
| `submitting`               | Atom of `boolean` for submission waiting state                                                |

`F` is the schema's fields, `A` and `E` are the handler's success and failure types, and `ER` is the atom runtime's failure type. `FieldFailure` contains the top-level string `path`, `message` and optional submitted path `segments`; `Invalid` contains `messages`, a `FieldMessages` record, and optional `formMessage` for a whole-form refinement.

The lower-level `draft.ts` (`draft`), `refs.ts` (`fromRef`, `propertyRef`) and `statusOf.ts` (`statusOf`) modules hold the machinery the form composes; the examples use the form API instead.

For a custom lower-level `Persistence`, `observe(receive)` calls `receive` with decoded stored input (or `undefined` after removal) and returns a cleanup function. The receiver returns `true` only when it adopted the complete incoming input; `false` preserves the local revision when local fields remain. `revision()` captures a revision reader for a submission; `write(..., sameInput)` can keep that captured reader current when only untouched server fields refresh.

### Install and limits

```sh
pnpm add @shivaedev/form effect
```

For React bindings:

```sh
pnpm add @effect/atom-react react
```

The React mounting example also uses the application's `react-dom`. React and `@effect/atom-react` are optional peers; the core modules do not import them. The package needs Node 24 or newer.
- String field names are top-level schema keys. `fieldAt`, `changeAt` and `useFieldAt` accept nested path tuples. `useList` edits top-level arrays.
- Replace encoded values rather than mutating objects in place; use `change` for ordinary UI edits.
- Keep the form and registry for their intended session, and clean up the registry when that session ends.
- Decide in the application when to receive normalized rows and how to render general failures. Attach a draft owner when persisted input must end with the session.
