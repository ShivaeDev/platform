import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { Create, type Delete, type Import, Update } from "#modules/notes/notes.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { makeNotesRepository } from "./makeRepository.ts";
import { NoteSource } from "./Source.ts";

function unavailable() {
	return new ServiceUnavailable({ message: "Could not reach the notes database" });
}
function writeFailure(error: { readonly _tag: string }) {
	return error._tag === "OptimisticConcurrencyError"
		? new Conflict({ message: "This note changed. Refresh and review your draft before trying again." })
		: unavailable();
}

export const NotesService = defineService({
	id: "app/NotesService",
	initialize: makeNotesRepository,
	methods: (repository) => {
		function get(id: number, userId: string) {
			return Effect.gen(function* () {
				const rows = yield* repository.findMany({ limit: 1, where: { id, userId } }).pipe(Effect.mapError(unavailable));
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
				const trimmed = title.trim();
				if (trimmed === "") {
					return yield* Create.reject.Invalid({ field: "title", message: "Enter a title" });
				}
				const row = yield* repository.insert({ title: trimmed, userId, wordCount: null }).pipe(Effect.mapError(unavailable));
				return row;
			}).pipe(
				transact({ onSqlError: unavailable }),
				Effect.tap((row) => enqueue(row.id)),
			);
		}
		return {
			canRead: (id: number, userId: string) =>
				repository.findMany({ limit: 1, where: { id } }).pipe(
					Effect.map((rows) => rows[0] === undefined || rows[0].userId === userId),
					Effect.mapError(unavailable),
				),
			create,
			delete: (input: typeof Delete.payload.Type, userId: string) =>
				Effect.gen(function* () {
					yield* get(input.id, userId);
					yield* repository.delete(input.id, input.version).pipe(Effect.mapError(writeFailure));
				}).pipe(transact({ onSqlError: unavailable })),
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
					.pipe(Effect.mapError(unavailable)),
			update: (input: typeof Update.payload.Type, userId: string) =>
				Effect.gen(function* () {
					const row = yield* get(input.id, userId);
					const title = input.title.trim();
					if (title === "") {
						return yield* Update.reject.Invalid({ field: "title", message: "Enter a title" });
					}
					const saved = yield* repository.update({ ...row, ...input, title, wordCount: null }).pipe(Effect.mapError(writeFailure));
					return saved;
				}).pipe(
					transact({ onSqlError: unavailable }),
					Effect.tap((row) => enqueue(row.id)),
				),
		};
	},
	requires: [SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs, NoteSource],
});
