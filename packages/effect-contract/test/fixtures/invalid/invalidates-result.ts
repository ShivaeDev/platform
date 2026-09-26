import { Schema } from "effect";
import { command } from "../../../src/index.ts";
import { Note, notes } from "../../notes.ts";

command("touch", {
	payload: { id: Schema.Number },
	success: Note,
	invalidates: (_payload, result) => [notes.item(result.missing)],
});
