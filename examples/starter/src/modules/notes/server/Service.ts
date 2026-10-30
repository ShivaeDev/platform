import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Conflict, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { OptimisticConcurrencyError } from "@shivaedev/sql/repository.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Create, Delete, Import, Update } from "#modules/notes/notes.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { makeNotesRepository } from "./makeRepository.ts";
import { NoteSource } from "./Source.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

function changed(cause: OptimisticConcurrencyError) {
	return Effect.fail(Object.assign(new Conflict({ message: "This note changed. Refresh and review your draft before trying again." }), { cause }));
}

export const NotesService = defineService({
	id: "app/NotesService",
	initialize: makeNotesRepository,
	methods: (repository) => {
		function get(id: number, userId: string) {
			return Effect.gen(function* () {
				const rows = yield* repository
					.findMany({ limit: 1, where: { id, userId } })
					.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))));
				return rows[0] ?? (yield* Effect.fail(new NotFound({ message: "Note not found" })));
			});
		}
		function enqueue(noteId: number) {
			return Effect.gen(function* () {
				const jobs = yield* NoteJobs;
				yield* jobs.enqueue(CountWords, { noteId }).pipe(Effect.catch((error) => Effect.logError({ error, event: "note_enqueue_failed", noteId })));
			});
		}
		function create({ title }: typeof Create.payload.Type, userId: string) {
			return Effect.gen(function* () {
				const row = yield* repository.insert({ title, userId, wordCount: null });
				return row;
			}).pipe(
				transact({ onSqlError: notesSqlFailure }),
				Effect.tap((row) => enqueue(row.id)),
			);
		}
		return {
			canRead: (id: number, userId: string) =>
				repository.findMany({ limit: 1, where: { id } }).pipe(
					Effect.map((rows) => rows[0] === undefined || rows[0].userId === userId),
					Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))),
				),
			create,
			delete: (input: typeof Delete.payload.Type, userId: string) =>
				Effect.gen(function* () {
					yield* get(input.id, userId);
					yield* repository.delete(input.id, input.version).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
				}).pipe(transact({ onSqlError: notesSqlFailure })),
			get,
			import: (input: typeof Import.payload.Type, userId: string) =>
				Effect.gen(function* () {
					const source = yield* NoteSource;
					const title = yield* source.title(input.id);
					return yield* create({ title }, userId);
				}),
			list: (userId: string) =>
				repository
					.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title", "wordCount", "version"], where: { userId } })
					.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error)))),
			update: (input: typeof Update.payload.Type, userId: string) =>
				Effect.gen(function* () {
					const row = yield* get(input.id, userId);
					const saved = yield* repository.update({ ...row, ...input, wordCount: null }).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
					return saved;
				}).pipe(
					transact({ onSqlError: notesSqlFailure }),
					Effect.tap((row) => enqueue(row.id)),
				),
		};
	},
	requires: [SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs, NoteSource],
});
