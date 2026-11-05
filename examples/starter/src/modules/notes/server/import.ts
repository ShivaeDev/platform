import { Effect } from "effect";
import type { Import } from "#modules/notes/notes.ts";
import { createNote } from "./create.ts";
import type { NotesRepository } from "./makeRepository.ts";
import { NoteSource } from "./Source.ts";

export function importNote(repository: NotesRepository) {
	const create = createNote(repository);
	return Effect.fn("NotesService.import")(function* (input: typeof Import.payload.Type, userId: string) {
		const source = yield* NoteSource;
		const title = yield* source.title(input.id);
		return yield* create({ title }, userId);
	});
}
