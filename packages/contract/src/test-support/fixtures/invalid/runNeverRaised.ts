import { command } from "#operation.ts";
import { NoteMissing } from "#test/notes.ts";
import { NoteFields, SessionUser } from "#test/runNotes.ts";

command("listsTooMuch", {
	payload: NoteFields,
	rejections: { NoteMissing },
	*run({ title }) {
		const { id } = yield* SessionUser;
		return `${id}: ${title}`;
	},
});
