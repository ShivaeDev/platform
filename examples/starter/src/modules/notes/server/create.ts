import { Effect } from "effect";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Create } from "#modules/notes/notes.ts";
import { enqueueNote } from "./enqueue.ts";
import type { NotesRepository } from "./makeRepository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export function createNote(repository: NotesRepository) {
	return Effect.fn("NotesService.create")(({ title }: typeof Create.payload.Type, userId: string) =>
		rateLimit({ key: `notes.create:${userId}`, per: 10, window: "1 minute" }).pipe(
			Effect.andThen(
				repository.insert({ title, userId, wordCount: null }).pipe(
					Effect.tap((row) => enqueueNote(row.id)),
					transact({ onSqlError: notesSqlFailure }),
				),
			),
		),
	);
}
