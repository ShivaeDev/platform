import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

query("titles", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const titles: string[] = [`Groceries of ${id}`];
		return titles;
	},
	success: Schema.Array(Schema.String),
});
