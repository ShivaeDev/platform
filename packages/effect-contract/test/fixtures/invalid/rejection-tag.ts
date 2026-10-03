import { query } from "../../../src/index.ts";
import { Note, NoteMissing } from "../../notes.ts";

query("mislabelled", {
	reads: () => [],
	rejections: { Gone: NoteMissing },
	success: Note,
});
