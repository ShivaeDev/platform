import { useEditor } from "#client/editor.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useMissingFixed() {
	return useEditor(api.rename, { query: api.get.query({ id: 1 }) });
}
