import { Schema } from "effect";
import { query } from "../../../src/index.ts";
import { Note, notes } from "../../notes.ts";

query("find", {
	payload: { id: Schema.Number },
	success: Note,
	reads: ({ slug }) => [notes.item(slug)],
});
