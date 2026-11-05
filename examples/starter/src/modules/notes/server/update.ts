import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Update } from "#modules/notes/notes.ts";
import { changed } from "./changed.ts";
import { enqueueNote } from "./enqueue.ts";
import { getNote } from "./get.ts";
import type { NotesRepository } from "./makeRepository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export function updateNote(repository: NotesRepository) {
	const get = getNote(repository);
	return Effect.fn("NotesService.update")(
		function* (input: typeof Update.payload.Type, userId: string) {
			const row = yield* get(input.id, userId);
			return yield* repository.update({ ...row, ...input, wordCount: null }).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
		},
		Effect.tap((row) => enqueueNote(row.id)),
		transact({ onSqlError: notesSqlFailure }),
	);
}
