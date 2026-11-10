import { Schema } from "effect";
import { command } from "#operation.ts";
import { NoteFields, SessionUser } from "#test/runNotes.ts";

command("neverPins", {
	payload: NoteFields,
	*run({ title }) {
		yield* SessionUser;
		return { id: 1, title };
	},
	success: Schema.Struct({ id: Schema.Number, pinned: Schema.optionalKey(Schema.Boolean), title: Schema.String }),
});
