import { Schema } from "effect";
import { query } from "#index.ts";
import { Note, notes } from "#test/notes.ts";

query("byTitle", {
	payload: { title: Schema.String },
	reads: ({ title }) => [notes.item(title)],
	success: Note,
});
