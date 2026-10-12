import { Effect } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Create } from "#notes.ts";
import { makeNotesRepository } from "./makeNotesRepository.ts";

function unavailable() {
	return new ServiceUnavailable({ message: "Could not reach the notes database" });
}

export const NotesService = defineService({
	id: "starter/NotesService",
	initialize: makeNotesRepository,
	methods: (repository) => ({
		create: ({ title }: typeof Create.payload.Type) =>
			Effect.gen(function* () {
				const trimmed = title.trim();
				if (trimmed === "") {
					return yield* Create.reject.Invalid({ field: "title", message: "Enter a title" });
				}
				return yield* repository.insert({ title: trimmed }).pipe(Effect.mapError(unavailable));
			}).pipe(transact({ onSqlError: unavailable })),
		list: () => repository.findMany({ orderBy: { direction: "desc", field: "id" } }).pipe(Effect.mapError(unavailable)),
	}),
	requires: [SqlClient.SqlClient, Reactivity.Reactivity],
});
