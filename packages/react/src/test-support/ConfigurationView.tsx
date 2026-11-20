import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useField } from "@shivaedev/form/adapters/react.ts";
import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import { type ConfigurationProps, type Current, Destination, type Name, Rejected } from "#test/configurationModel.ts";

const query = Atom.make(AsyncResult.success({ name: "stored" }));
export function ConfigurationView(props: ConfigurationProps) {
	const { revision, rejected, mapping, held, saved } = props;
	function toName() {
		return { field: "name" as const, message: revision };
	}
	const config = {
		fields: props.fields,
		persistedDraft: { key: `${props.kind}-${revision}`, now: props.now, storage: () => window.localStorage },
		...(mapping ? { failures: { Rejected: toName } } : {}),
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
		<CreateView config={config} held={held} revision={revision} runtime={props.runtime} save={save} />
	) : (
		<EditorView config={config} held={held} revision={revision} runtime={props.runtime} save={save} />
	);
}
interface ViewProps {
	readonly config: Pick<ConfigurationProps, "fields"> & {
		readonly persistedDraft: PersistedDraftConfig;
		readonly failures?: { readonly Rejected: () => { field: "name"; message: string } };
	};
	readonly held: ConfigurationProps["held"];
	readonly revision: string;
	readonly runtime: ConfigurationProps["runtime"];
	readonly save: (values: Name) => Effect.Effect<Name, Rejected, Destination>;
}
function CreateView({ config, held, revision, runtime, save }: ViewProps) {
	const current = useCreate({ run: save, runtime }, { ...config, initialValues: { name: revision } });
	held.current = current;
	return <Controls current={current} />;
}
function EditorView({ config, held, revision, runtime, save }: ViewProps) {
	const current = useEditor(
		{ run: save, runtime },
		{ ...config, loaded: { name: "stored" }, query, values: (row) => ({ name: `${revision}:${row.name}` }) },
	);
	held.current = current;
	return <Controls current={current} />;
}
function Controls({ current }: { readonly current: Current }) {
	const name = useField(current.form, "name");
	const created = "created" in current ? Option.getOrNull(current.created) : undefined;
	return (
		<section>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<button onClick={current.save} type="button">
				Save
			</button>
			<button onClick={current.revert} type="button">
				Revert
			</button>
			<output data-saving={current.saving}>{JSON.stringify({ created, error: name.error })}</output>
		</section>
	);
}
