import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteFields, SessionUser } from "#test/runNotes.ts";

const Operation = command("neverPins", {
	payload: NoteFields,
	*run({ title }) {
		yield* SessionUser;
		return { id: 1, title };
	},
});

defineModule({
	name: "neverPins",
	operations: [Operation],
	wire: {
		neverPins: { rejections: {}, success: Schema.Struct({ id: Schema.Number, pinned: Schema.optionalKey(Schema.Boolean), title: Schema.String }) },
	},
});
