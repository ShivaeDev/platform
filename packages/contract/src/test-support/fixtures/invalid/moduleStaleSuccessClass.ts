import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteFields, NotesRepository, SessionUser } from "#test/runNotes.ts";

class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String }) {}

const Operation = command("returnsPlainNote", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		const { id } = yield* repository.insert(title, userId);
		return { id, title };
	},
});

defineModule({
	name: "returnsPlainNote",
	operations: [Operation],
	wire: { returnsPlainNote: { rejections: {}, success: Note } },
});
