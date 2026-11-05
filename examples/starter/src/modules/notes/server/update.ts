import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Update } from "#modules/notes/notes.ts";
import { changed } from "./changed.ts";
import { enqueueNote } from "./enqueue.ts";
import { getNote } from "./get.ts";
import { NotesRepository } from "./Repository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export const updateNote = Effect.fn("NotesService.updateNote")(
	function* (input: typeof Update.payload.Type) {
		const repository = yield* NotesRepository;
		const row = yield* getNote(input.id);
		return yield* repository.update({ ...row, ...input, wordCount: null }).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
	},
	Effect.tap((row) => enqueueNote(row.id)),
	transact({ onSqlError: notesSqlFailure }),
);
