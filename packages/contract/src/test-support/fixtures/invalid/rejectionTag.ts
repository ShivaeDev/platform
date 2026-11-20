import { stream } from "#operation.ts";
import { Note, NoteMissing } from "#test/notes.ts";

stream("mislabelled", { reads: () => [], rejections: { Gone: NoteMissing }, success: Note });
