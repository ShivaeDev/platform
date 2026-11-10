import { Schema } from "effect";
import { command } from "#operation.ts";
import { NoteFields, NotesRepository, SessionUser } from "#test/runNotes.ts";

command("leaksRow", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.insert(title, userId);
	},
	success: Schema.Struct({ id: Schema.Number, title: Schema.String }),
});
