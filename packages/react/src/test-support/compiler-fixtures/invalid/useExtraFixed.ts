import { useEditor } from "#client/editor.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useExtraFixed() {
	return useEditor(api.update, { fixed: { id: 1, owner: "ada" }, query: api.get.query({ id: 1 }) });
}
