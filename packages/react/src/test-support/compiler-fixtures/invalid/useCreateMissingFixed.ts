import { useCreate } from "#client/create.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useCreateMissingFixed() {
	return useCreate(api.update, { initialValues: { title: "" } });
}
