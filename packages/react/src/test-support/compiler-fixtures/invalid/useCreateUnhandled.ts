import { useCreate } from "#client/create.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useCreateUnhandled() {
	return useCreate(api.retitle, { initialValues: { id: 1, title: "" } });
}
