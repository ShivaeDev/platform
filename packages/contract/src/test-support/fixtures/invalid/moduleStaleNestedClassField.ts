import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteFields, NotesRepository, SessionUser } from "#test/runNotes.ts";

class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String }) {}

const Operation = command("createsPlainNote", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		const { id } = yield* repository.insert(title, userId);
		return { note: { id, title }, saved: true };
	},
});

defineModule({
	name: "createsPlainNote",
	operations: [Operation],
	requires: [NotesRepository, SessionUser],
	wire: { createsPlainNote: { rejections: {}, success: Schema.Struct({ note: Note, saved: Schema.Boolean }) } },
});
