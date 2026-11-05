import { Effect } from "effect";
import type { Delete } from "#modules/notes/notes.ts";
import { changed } from "./changed.ts";
import { getNote } from "./get.ts";
import { NotesRepository } from "./Repository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export const deleteNote = Effect.fn("NotesService.deleteNote")(
	function* (input: typeof Delete.payload.Type) {
		const repository = yield* NotesRepository;
		yield* getNote(input.id);
		yield* repository.delete(input.id, input.version).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
	},
	Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))),
);
