import { Effect } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { NoteEdit, toNote } from "#modules/notes/model.ts";
import { changed } from "#modules/notes/server/changed.ts";
import { enqueueNote } from "#modules/notes/server/enqueue.ts";
import { ownedNote } from "#modules/notes/server/owned.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const Update = command("update", {
	payload: NoteEdit,
	*run(input) {
		const repository = yield* NotesRepository;
		return yield* ownedNote(input.id).pipe(
			Effect.flatMap((row) => repository.update({ ...row, ...input, wordCount: null })),
			Effect.catchTag("OptimisticConcurrencyError", changed),
			Effect.tap((row) => enqueueNote(row.id)),
			Effect.map(toNote),
			transact(),
		);
	},
});
