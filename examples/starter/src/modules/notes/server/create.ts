import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Create } from "#modules/notes/notes.ts";
import { enqueueNote } from "#modules/notes/server/enqueue.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesSqlFailure } from "#modules/notes/server/sqlFailure.ts";

export const createNote = Effect.fn("NotesService.createNote")(function* ({ title }: typeof Create.payload.Type) {
	const repository = yield* NotesRepository;
	const { id: userId } = yield* SessionUser;
	yield* rateLimit({ key: `notes.create:${userId}`, per: 10, window: "1 minute" });
	return yield* repository.insert({ title, userId, wordCount: null }).pipe(
		Effect.tap((row) => enqueueNote(row.id)),
		transact({ onSqlError: notesSqlFailure }),
	);
});
