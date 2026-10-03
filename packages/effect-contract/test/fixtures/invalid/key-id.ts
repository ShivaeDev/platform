import { Schema } from "effect";
import { query } from "../../../src/index.ts";
import { Note, notes } from "../../notes.ts";

query("byTitle", {
	payload: { title: Schema.String },
	reads: ({ title }) => [notes.item(title)],
	success: Note,
});
