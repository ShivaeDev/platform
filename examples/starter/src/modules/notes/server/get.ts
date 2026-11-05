import { Effect, Option } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import type { NotesRepository } from "./makeRepository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export function getNote(repository: NotesRepository) {
	return Effect.fn("NotesService.get")(function* (id: number, userId: string) {
		const row = yield* repository
			.findOne({ where: { id, userId } })
			.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))));
		return yield* Option.match(row, {
			onNone: () => Effect.fail(new NotFound({ message: "Note not found" })),
			onSome: Effect.succeed,
		});
	});
}
