import { query } from "#operation.ts";
import { Note, NoteMissing } from "#test/notes.ts";

query("mislabelled", {
	reads: () => [],
	rejections: { Gone: NoteMissing },
	success: Note,
});
