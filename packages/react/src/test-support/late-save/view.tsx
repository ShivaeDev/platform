import { RegistryContext } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useContext } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import type { FieldFailure, Form } from "@shivaedev/form/shape.ts";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import type { SaveState } from "#client/saveState.ts";
import { Fields, initial, type Model, runtime, type Values } from "./model.ts";

function save(state: Model, values: Values) {
	return Effect.as(
		Effect.promise(() => state.complete.promise),
		{ ...values, name: values.name.toUpperCase() },
	);
}

export function Editor({ state }: { readonly state: Model }) {
	const editor = useEditor({ fields: Fields, query: state.query, runtime, save: (values) => save(state, values), values: (row) => row });
	const registry = useContext(RegistryContext);
	return editor.form ? (
		<Controls
			current={{ ...editor, form: editor.form }}
			refresh={() => registry.set(state.query, AsyncResult.success({ name: "Remote", note: "Remote note" }))}
		/>
	) : null;
}

export function Create({ state }: { readonly state: Model }) {
	const current = useCreate({ create: (values) => save(state, values), fields: Fields, initialValues: initial, runtime });
	return <Controls current={current} />;
}

function Controls({
	current,
	refresh,
}: {
	readonly current: SaveState<never> & { readonly form: Form<typeof Fields.fields, Values, FieldFailure, never> };
	readonly refresh?: () => void;
}) {
	const { form } = current;
	const name = useField(form, "name");
	const note = useField(form, "note");
	const registry = useContext(RegistryContext);
	return (
		<section>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<input name="note" onChange={(event) => note.onChange(event.target.value)} value={note.value ?? ""} />
			<button onClick={current.save} type="button">
				Save
			</button>
			<button onClick={() => registry.set(form.submit, undefined)} type="button">
				Atom submit
			</button>
			<button onClick={current.revert} type="button">
				Revert
			</button>
			<button onClick={() => refresh?.()} type="button">
				Refresh
			</button>
			<button onClick={() => form.values.set({ name: form.values.value.name })} type="button">
				Remove note
			</button>
			<output data-saving={current.saving}>{JSON.stringify({ dirty: current.dirty, values: form.values.value })}</output>
		</section>
	);
}
