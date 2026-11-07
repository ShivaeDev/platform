import { Effect } from "effect";
import type { Delete } from "#modules/notes/notes.ts";
import { changed } from "#modules/notes/server/changed.ts";
import { getNote } from "#modules/notes/server/get.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesSqlFailure } from "#modules/notes/server/sqlFailure.ts";

export const deleteNote = Effect.fn("NotesService.deleteNote")(
	function* (input: typeof Delete.payload.Type) {
		const repository = yield* NotesRepository;
		yield* getNote(input.id);
		yield* repository.delete(input.id, input.version).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
	},
	Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))),
);
