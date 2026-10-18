import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Create, type Delete, Update } from "#notes.ts";
import { makeNotesRepository } from "./makeNotesRepository.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

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
		function get(id: number, ownerId: string) {
			return Effect.gen(function* () {
				const rows = yield* repository.findMany({ limit: 1, where: { id, ownerId } }).pipe(Effect.mapError(unavailable));
				return rows[0] ?? (yield* Effect.fail(new NotFound({ message: "Note not found" })));
			});
		}
		function enqueue(noteId: number) {
			return Effect.gen(function* () {
				const jobs = yield* NoteJobs;
				yield* jobs.enqueue(CountWords, { noteId }).pipe(Effect.catch((error) => Effect.logError({ error, event: "note_enqueue_failed", noteId })));
			});
		}
		return {
			create: ({ title }: typeof Create.payload.Type, ownerId: string) =>
				Effect.gen(function* () {
					const trimmed = title.trim();
					if (trimmed === "") {
						return yield* Create.reject.Invalid({ field: "title", message: "Enter a title" });
					}
					const row = yield* repository.insert({ ownerId, title: trimmed, wordCount: null }).pipe(Effect.mapError(unavailable));
					return row;
				}).pipe(
					transact({ onSqlError: unavailable }),
					Effect.tap((row) => enqueue(row.id)),
				),
			delete: (input: typeof Delete.payload.Type, ownerId: string) =>
				Effect.gen(function* () {
					yield* get(input.id, ownerId);
					yield* repository.delete(input.id, input.version).pipe(Effect.mapError(writeFailure));
				}).pipe(transact({ onSqlError: unavailable })),
			get,
			list: (ownerId: string) =>
				repository
					.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title", "wordCount", "version"], where: { ownerId } })
					.pipe(Effect.mapError(unavailable)),
			update: (input: typeof Update.payload.Type, ownerId: string) =>
				Effect.gen(function* () {
					const row = yield* get(input.id, ownerId);
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
	requires: [SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs],
});
