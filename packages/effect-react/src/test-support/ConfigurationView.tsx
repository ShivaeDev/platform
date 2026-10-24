import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useField } from "@shivaedev/effect-form/client/react.ts";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import { type ConfigurationProps, type Current, Destination, type Name, Rejected } from "./configurationModel.ts";

const query = Atom.make(AsyncResult.success({ name: "stored" }));
export function ConfigurationView(props: ConfigurationProps) {
	const { revision, rejected, mapping, held, saved } = props;
	const config = {
		fields: props.fields,
		persistedDraft: { key: `${props.kind}-${revision}` },
		...(mapping ? { rejectField: (_error: Rejected) => ({ field: "name" as const, message: revision }) } : {}),
		runtime: props.runtime,
	};
	function save(values: Name) {
		return Effect.gen(function* () {
			const destination = yield* Destination;
			saved.push(`${revision}:${destination}:${values.name}`);
			if (props.pending) {
				yield* Effect.promise(() => props.completion.promise);
			}
			if (rejected) {
				return yield* Effect.fail(new Rejected({ field: "name", message: "automatic" }));
			}
			return values;
		});
	}
	return props.kind === "create" ? (
		<CreateView config={config} held={held} revision={revision} save={save} />
	) : (
		<EditorView config={config} held={held} revision={revision} save={save} />
	);
}
interface ViewProps {
	readonly config: Pick<ConfigurationProps, "fields" | "runtime"> & {
		readonly persistedDraft: { readonly key: string };
		readonly rejectField?: (error: Rejected) => { field: "name"; message: string };
	};
	readonly held: ConfigurationProps["held"];
	readonly revision: string;
	readonly save: (values: Name) => Effect.Effect<Name, Rejected, Destination>;
}
function CreateView({ config, held, revision, save }: ViewProps) {
	const current = useCreate({ ...config, create: (values) => save(values), initialValues: { name: revision } });
	held.current = current;
	return <Controls current={current} />;
}
function EditorView({ config, held, revision, save }: ViewProps) {
	const current = useEditor({
		...config,
		loaded: { name: "stored" },
		query,
		save: (values) => save(values),
		values: (row) => ({ name: `${revision}:${row.name}` }),
	});
	held.current = current;
	return <Controls current={current} />;
}
function Controls({ current }: { readonly current: Current }) {
	const name = useField(current.form, "name");
	return (
		<section>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<button onClick={current.save} type="button">
				Save
			</button>
			<button onClick={current.revert} type="button">
				Revert
			</button>
			<output>{JSON.stringify({ created: "created" in current ? Option.getOrNull(current.created) : undefined, error: name.error })}</output>
		</section>
	);
}
