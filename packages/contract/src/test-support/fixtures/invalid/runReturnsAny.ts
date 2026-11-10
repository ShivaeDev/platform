import { Schema } from "effect";
import { command } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

command("parsesDraft", {
	payload: { raw: Schema.String },
	*run({ raw }) {
		yield* SessionUser;
		return JSON.parse(raw);
	},
	success: Schema.Struct({ title: Schema.String }),
});
