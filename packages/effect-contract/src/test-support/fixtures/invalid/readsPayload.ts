import { Schema } from "effect";
import { query } from "#operation.ts";
import { Note, notes } from "#test/notes.ts";

query("find", {
	payload: { id: Schema.Number },
	reads: ({ slug }) => [notes.item(slug)],
	success: Note,
});
