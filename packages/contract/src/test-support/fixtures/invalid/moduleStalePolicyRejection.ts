import { Effect, Schema } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { NoteId, SessionUser } from "#test/runNotes.ts";

const Operation = query("forgetsPolicyFailure", {
	payload: NoteId,
	readPolicy: () => Effect.fail(new NotFound({ message: "Note not found" })),
	reads: () => [],
	*run({ id }) {
		const user = yield* SessionUser;
		return `${user.id}: ${id}`;
	},
});

defineModule({
	name: "forgetsPolicyFailure",
	operations: [Operation],
	requires: [SessionUser],
	wire: { forgetsPolicyFailure: { rejections: {}, success: Schema.String } },
});
