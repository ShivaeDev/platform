import { useAction } from "#client/resultState.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useQueryAction() {
	return useAction(api.get);
}
