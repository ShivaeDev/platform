import { useEditor } from "#client/editor.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useIncompleteFixed() {
	return useEditor(api.rename, { fixed: { id: 1 }, query: api.get.query({ id: 1 }) });
}
