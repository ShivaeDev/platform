import { query } from "../../../src/index.ts";
import { Note, NoteMissing } from "../../notes.ts";

query("mislabelled", {
	success: Note,
	rejections: { Gone: NoteMissing },
	reads: () => [],
});
