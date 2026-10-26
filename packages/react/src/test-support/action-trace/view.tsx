import { Effect, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import { useAction } from "#client/resultState.ts";
import type { connect } from "./connect.ts";

type Client = ReturnType<typeof connect>;
const EmptyFields = Schema.Struct({});
export function Action({ client }: { readonly client: Client }) {
	const action = useAction(client.action);
	return (
		<button disabled={action.pending} onClick={() => action.dispatch(undefined)} type="button">
			Write
		</button>
	);
}
export function Create({ client }: { readonly client: Client }) {
	const create = useCreate({ create: client.run, fields: EmptyFields, initialValues: {}, runtime: client.runtime });
	return (
		<button disabled={create.saving} onClick={create.save} type="button">
			Write
		</button>
	);
}

const emptyRow = Atom.make(Effect.succeed(""));
export function Editor({ client }: { readonly client: Client }) {
	const editor = useEditor({ fields: EmptyFields, query: emptyRow, runtime: client.runtime, save: client.run, values: () => ({}) });
	return (
		<button disabled={!editor.form || editor.saving} onClick={editor.save} type="button">
			Write
		</button>
	);
}
