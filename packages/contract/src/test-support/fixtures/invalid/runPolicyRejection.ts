import { Effect } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { query } from "#operation.ts";
import { NoteId, SessionUser } from "#test/runNotes.ts";

query("forgetsPolicyFailure", {
	payload: NoteId,
	readPolicy: () => Effect.fail(new NotFound({ message: "Note not found" })),
	reads: () => [],
	rejections: {},
	*run({ id }) {
		const user = yield* SessionUser;
		return `${user.id}: ${id}`;
	},
});
