import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { command } from "#operation.ts";
import { NoteFields, TitleTaken } from "#test/runNotes.ts";

command("forgetsTitleTaken", {
	payload: NoteFields,
	rejections: { NotFound },
	*run({ title }) {
		if (title === "missing") {
			return yield* new NotFound({ message: "Note not found" });
		}
		return yield* new TitleTaken({ field: "title", message: "That title is reserved" });
	},
});
