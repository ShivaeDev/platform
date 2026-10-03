import { Schema } from "effect";
import { query } from "../../../src/index.ts";
import { Note, notes } from "../../notes.ts";

query("find", {
	payload: { id: Schema.Number },
	reads: ({ slug }) => [notes.item(slug)],
	success: Note,
});
