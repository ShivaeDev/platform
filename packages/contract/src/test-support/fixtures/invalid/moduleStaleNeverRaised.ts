import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteMissing } from "#test/notes.ts";
import { NoteFields, SessionUser } from "#test/runNotes.ts";

const Operation = command("listsTooMuch", {
	payload: NoteFields,
	*run({ title }) {
		const { id } = yield* SessionUser;
		return `${id}: ${title}`;
	},
});

defineModule({
	name: "listsTooMuch",
	operations: [Operation],
	requires: [SessionUser],
	wire: { listsTooMuch: { rejections: { NoteMissing }, success: Schema.String } },
});
