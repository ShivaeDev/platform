import { Schema } from "effect";
import { command } from "#operation.ts";
import { NoteFields, SessionUser } from "#test/runNotes.ts";

interface PinnableNote {
	readonly id: number;
	readonly pinned?: boolean;
	readonly title: string;
}

command("returnsPinnable", {
	payload: NoteFields,
	*run({ title }) {
		yield* SessionUser;
		const note: PinnableNote = { id: 1, pinned: true, title };
		return note;
	},
	success: Schema.Struct({ id: Schema.Number, title: Schema.String }),
});
