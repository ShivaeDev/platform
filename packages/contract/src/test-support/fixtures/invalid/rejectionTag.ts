import { query } from "#operation.ts";
import { Note, NoteMissing } from "#test/notes.ts";

query("mislabelled", { readPolicy: () => Effect.succeed(true), reads: () => [], rejections: { Gone: NoteMissing }, success: Note });
