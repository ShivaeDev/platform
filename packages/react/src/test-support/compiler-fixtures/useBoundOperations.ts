import { Schema } from "effect";
import { useUndoableChange } from "#client/adapters/useUndoableChange.ts";
import { useCreate } from "#client/create.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useEditor } from "#client/editor.ts";
import { useAction } from "#client/resultState.ts";
import { api, type SubtitleRejected } from "#test/compiler-fixtures/notes.ts";

const query = api.get.query({ id: 1 });
const Draft = Schema.Struct({ title: Schema.Trim });
function savedFirst() {
	return { message: "Someone else saved first" };
}
function onTitle(error: SubtitleRejected) {
	return { field: "title" as const, message: error.message };
}

export function useBoundOperations(update: ReturnType<typeof deployUpdate>) {
	const removed = useAction(api.remove, { onSuccess: () => undefined });
	const created = useCreate(api.create, { initialValues: { title: "" } });
	const edited = useEditor(api.update, { fixed: { id: 1 }, query });
	const loaded = useEditor(api.update, { fixed: { id: 1 }, loaded: { id: 1, title: "", version: 1, words: 0 }, query });
	const renamed = useEditor(api.rename, { fixed: { expectedVersion: 1, id: 1 }, query });
	const trimmed = useEditor(api.rename, { fields: Draft, fixed: { expectedVersion: 1, id: 1 }, query });
	const custom = useEditor(
		{ run: (values: typeof Draft.Type) => api.rename.run({ expectedVersion: 1, id: 1, ...values }), runtime: api.rename.runtime },
		{ fields: Draft, query, values: (note) => ({ title: note.title.toUpperCase() }) },
	);
	const undoable = useUndoableChange(api.rename, { describe: (note) => note.title, update });
	const retitled = useAction(api.retitle, { failures: { SubtitleRejected: (error, input) => ({ message: `${input.title}: ${error.message}` }) } });
	const quiet = useAction(api.retitle, { silent: true });
	const worded = useAction(api.retitle, { failures: { Conflict: savedFirst, SubtitleRejected: "message" } });
	const retitling = useEditor(api.retitle, {
		failures: { SubtitleRejected: onTitle },
		fixed: { id: 1 },
		query,
	});
	return { created, custom, edited, loaded, quiet, removed, renamed, retitled, retitling, trimmed, undoable, worded };
}
