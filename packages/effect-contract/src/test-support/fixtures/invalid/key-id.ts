import { Schema } from "effect";
import { query } from "#operation.ts";
import { Note, notes } from "#test/notes.ts";

query("byTitle", {
	payload: { title: Schema.String },
	reads: ({ title }) => [notes.item(title)],
	success: Note,
});
