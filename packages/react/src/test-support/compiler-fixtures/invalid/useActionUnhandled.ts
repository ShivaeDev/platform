import { useAction } from "#client/resultState.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useActionUnhandled() {
	return useAction(api.retitle);
}
