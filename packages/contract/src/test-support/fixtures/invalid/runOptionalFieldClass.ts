import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, title: Schema.String }) {}

query("featuresPlainNote", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const featured: { readonly note?: { id: number; title: string } | undefined } = { note: { id: 1, title: id } };
		return featured;
	},
	success: Schema.Struct({ note: Schema.optional(Note) }),
});
