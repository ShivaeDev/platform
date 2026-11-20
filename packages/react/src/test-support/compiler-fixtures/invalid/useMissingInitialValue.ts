import { useCreate } from "#client/create.ts";
import { api } from "#test/compiler-fixtures/notes.ts";

export function useMissingInitialValue() {
	return useCreate(api.create, { initialValues: {} });
}
