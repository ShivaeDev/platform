import { useAction } from "#client/resultState.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useActionForeignFailure() {
	return useAction(api.retitle, { failures: { SubtitleRejected: "message", TitleRejected: "silent" } });
}
