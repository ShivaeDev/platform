import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteFields, NotesRepository, SessionUser } from "#test/runNotes.ts";

const Operation = command("leaksRow", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.insert(title, userId);
	},
});

defineModule({
	name: "leaksRow",
	operations: [Operation],
	requires: [NotesRepository, SessionUser],
	wire: { leaksRow: { rejections: {}, success: Schema.Struct({ id: Schema.Number, title: Schema.String }) } },
});
