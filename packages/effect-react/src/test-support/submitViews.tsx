import { RegistryContext } from "@effect/atom-react";
import { Effect, Layer, Option, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useMemo } from "react";
import { useField, useSubmit } from "@shivaedev/effect-form/client/react.ts";
import { useCreate } from "#client/create.ts";
import { type Editor, useEditor } from "#client/editor.ts";

const Name = Schema.Struct({ name: Schema.String });
const runtime = Atom.runtime(Layer.empty);
export interface SubmitState {
	readonly decoding: PromiseWithResolvers<void>;
	readonly names: string[];
}
export function CreateSubmitView({ state, slow }: { readonly state: SubmitState; readonly slow: boolean }) {
	const Submission = useMemo(() => {
		function decoded(value: string) {
			return Effect.as(
				Effect.promise(() => state.decoding.promise),
				value,
			);
		}
		return Schema.Struct({
			name: slow
				? Schema.String.pipe(
						Schema.decodeTo(Schema.String, {
							decode: SchemaGetter.transformEffect(decoded),
							encode: SchemaGetter.transform((value: string) => value),
						}),
					)
				: Schema.String,
		});
	}, [slow, state]);
	const current = useCreate({
		create: (values) => Effect.sync(() => ({ id: state.names.push(values.name), name: slow ? values.name : values.name.trim() })),
		fields: Submission,
		initialValues: { name: "" },
		runtime,
	});
	const name = useField(current.form, "name");
	const submit = useSubmit(current.form);
	const registry = useContext(RegistryContext);
	return (
		<section>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<button onClick={submit.run} type="button">
				Form submit
			</button>
			<button onClick={() => registry.set(current.form.submit, undefined)} type="button">
				Atom submit
			</button>
			<button onClick={current.save} type="button">
				Save
			</button>
			<output>{JSON.stringify({ created: Option.getOrNull(current.created), values: current.form.values.value })}</output>
		</section>
	);
}
const query = Atom.make(Effect.succeed({ id: 1, name: "desk lamps" }));
export function EditorSubmitView() {
	const editor = useEditor({
		fields: Name,
		query,
		runtime,
		save: (values) => Effect.succeed({ id: 1, name: values.name.toUpperCase() }),
		values: (row) => ({ name: row.name }),
	});
	const registry = useContext(RegistryContext);
	return editor.form ? <LoadedEditor editor={editor} registry={registry} /> : null;
}
function LoadedEditor({
	editor,
	registry,
}: {
	readonly editor: Editor<typeof Name.fields, { id: number; name: string }, never, never, never>;
	readonly registry: React.ContextType<typeof RegistryContext>;
}) {
	if (!editor.form) {
		throw new Error("No editor form");
	}
	const form = editor.form;
	const name = useField(form, "name");
	return (
		<section>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<button onClick={() => registry.set(form.submit, undefined)} type="button">
				Atom submit
			</button>
			<output>{JSON.stringify({ dirty: editor.dirty, values: form.values.value })}</output>
		</section>
	);
}
