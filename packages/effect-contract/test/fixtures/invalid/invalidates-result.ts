import { Schema } from "effect";
import { command } from "#index.ts";
import { Note, notes } from "#test/notes.ts";

command("touch", {
	invalidates: (_payload, result) => [notes.item(result.missing)],
	payload: { id: Schema.Number },
	success: Note,
});
