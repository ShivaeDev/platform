import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Update } from "#modules/notes/notes.ts";
import { changed } from "#modules/notes/server/changed.ts";
import { enqueueNote } from "#modules/notes/server/enqueue.ts";
import { getNote } from "#modules/notes/server/get.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesSqlFailure } from "#modules/notes/server/sqlFailure.ts";

export const updateNote = Effect.fn("Notes.updateNote")(
	function* (input: typeof Update.payload.Type) {
		const repository = yield* NotesRepository;
		const row = yield* getNote(input.id);
		return yield* repository.update({ ...row, ...input, wordCount: null }).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
	},
	Effect.tap((row) => enqueueNote(row.id)),
	transact({ onSqlError: notesSqlFailure }),
);
