import { Effect } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Create, notes } from "#notes.ts";
import { jobDatabase } from "./jobDatabase.ts";
import { makeNotesRepository } from "./makeNotesRepository.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

function unavailable() {
	return new ServiceUnavailable({ message: "Could not reach the notes database" });
}

export const NotesService = defineService({
	id: "starter/NotesService",
	initialize: makeNotesRepository,
	methods: (repository) => ({
		create: ({ title }: typeof Create.payload.Type, ownerId: string) =>
			Effect.gen(function* () {
				const trimmed = title.trim();
				if (trimmed === "") {
					return yield* Create.reject.Invalid({ field: "title", message: "Enter a title" });
				}
				const row = yield* repository.insert({ ownerId, title: trimmed, wordCount: null }).pipe(Effect.mapError(unavailable));
				const jobs = yield* NoteJobs;
				const db = yield* jobDatabase;
				yield* jobs.enqueue(CountWords, { noteId: row.id }, { db }).pipe(Effect.mapError(unavailable));
				yield* invalidateOnCommit(invalidationKeys([notes.item(row.id)]));
				return row;
			}).pipe(transact({ onSqlError: unavailable })),
		list: (ownerId: string) =>
			repository
				.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title", "wordCount"], where: { ownerId } })
				.pipe(Effect.mapError(unavailable)),
	}),
	requires: [SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs],
});
