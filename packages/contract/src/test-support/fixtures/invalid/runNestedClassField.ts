import { Schema } from "effect";
import { command } from "#operation.ts";
import { NoteFields, NotesRepository, SessionUser } from "#test/runNotes.ts";

class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String }) {}

command("createsPlainNote", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		const { id } = yield* repository.insert(title, userId);
		return { note: { id, title }, saved: true };
	},
	success: Schema.Struct({ note: Note, saved: Schema.Boolean }),
});
