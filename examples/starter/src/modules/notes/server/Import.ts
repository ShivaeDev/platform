import { command } from "@shivaedev/contract/operation.ts";
import { NoteId } from "#modules/notes/model.ts";
import { Create } from "#modules/notes/server/Create.ts";
import { NoteSource } from "#modules/notes/server/Source.ts";

export const Import = command("import", {
	payload: NoteId,
	*run({ id }) {
		const source = yield* NoteSource;
		const title = yield* source.title(id);
		return yield* Create.run({ title });
	},
});
