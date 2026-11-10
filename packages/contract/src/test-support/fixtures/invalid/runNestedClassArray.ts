import { Schema } from "effect";
import { query } from "#operation.ts";
import { NotesRepository, SessionUser } from "#test/runNotes.ts";

interface PlainNote {
	readonly id: number;
	readonly title: string;
}

function plain(notes: readonly PlainNote[]): readonly { id: number; title: string }[] {
	return notes.map(({ id, title }) => ({ id, title }));
}

class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String }) {}

query("listsPlainNotes", {
	reads: () => [],
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return plain(yield* repository.findMany(userId));
	},
	success: Schema.Array(Note),
});
