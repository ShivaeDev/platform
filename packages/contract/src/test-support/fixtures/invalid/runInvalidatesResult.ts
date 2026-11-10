import { command } from "#operation.ts";
import { NoteFields, runNotes, SessionUser } from "#test/runNotes.ts";

command("readsUndeclaredResult", {
	invalidates: (_fields, note) => [runNotes.item(note.id)],
	payload: NoteFields,
	*run({ title }) {
		const { id: userId } = yield* SessionUser;
		return { id: 1, title, userId };
	},
});
