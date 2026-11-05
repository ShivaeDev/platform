import { Effect } from "effect";
import type { Import } from "#modules/notes/notes.ts";
import { createNote } from "./create.ts";
import { NoteSource } from "./Source.ts";

export const importNote = Effect.fn("NotesService.importNote")(function* (input: typeof Import.payload.Type) {
	const source = yield* NoteSource;
	const title = yield* source.title(input.id);
	return yield* createNote({ title });
});
