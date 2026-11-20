import { useEditor } from "#client/editor.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useEditorUnhandled() {
	return useEditor(api.retitle, { fixed: { id: 1 }, query: api.get.query({ id: 1 }) });
}
