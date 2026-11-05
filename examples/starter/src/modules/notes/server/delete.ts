import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Delete } from "#modules/notes/notes.ts";
import { changed } from "./changed.ts";
import { getNote } from "./get.ts";
import type { NotesRepository } from "./makeRepository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export function deleteNote(repository: NotesRepository) {
	const get = getNote(repository);
	return Effect.fn("NotesService.delete")(
		function* (input: typeof Delete.payload.Type, userId: string) {
			yield* get(input.id, userId);
			yield* repository.delete(input.id, input.version).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
		},
		transact({ onSqlError: notesSqlFailure }),
	);
}
