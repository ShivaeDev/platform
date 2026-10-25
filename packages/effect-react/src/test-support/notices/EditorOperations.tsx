import { Effect } from "effect";
import { useEditor } from "#client/editor.ts";
import { useAction } from "#client/resultState.ts";
import type { NoticeClient } from "./client.ts";
import { Fields } from "./Fields.ts";

export function EditorOperations({ client }: { readonly client: NoticeClient }) {
	const editor = useEditor({
		fields: Fields,
		loaded: "existing",
		notices: { onSuccess: (title) => ({ message: `Saved ${title}` }) },
		query: client.api.list.query(),
		queryNotice: () => ({ message: "Editor refresh failed" }),
		runtime: client.runtime,
		save: (values) => client.api.remove.run(values).pipe(Effect.as(values.title)),
		values: (title) => ({ title }),
	});
	const breakReads = useAction(client.runtime, client.api.breakReads.run);
	return (
		<>
			<button onClick={editor.save} type="button">
				Save editor
			</button>
			<button onClick={() => breakReads.dispatch(undefined)} type="button">
				Break refresh
			</button>
			<output data-rows="">{editor.query.data}</output>
		</>
	);
}
