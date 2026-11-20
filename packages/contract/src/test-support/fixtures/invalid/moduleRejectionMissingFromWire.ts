import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteId, SessionUser } from "#test/runNotes.ts";

const Remove = command("remove", {
	payload: NoteId,
	*run({ id }) {
		yield* SessionUser;
		if (id === 0) {
			return yield* new NotFound({ message: "Note not found" });
		}
	},
});

defineModule({
	name: "removes",
	operations: [Remove],
	requires: [SessionUser],
	wire: {},
});
