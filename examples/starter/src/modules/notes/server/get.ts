import { Effect, Option } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NotesRepository } from "./Repository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export const getNote = Effect.fn("NotesService.getNote")(function* (id: number) {
	const repository = yield* NotesRepository;
	const { id: userId } = yield* SessionUser;
	const row = yield* repository.findOne({ where: { id, userId } }).pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))));
	return yield* Option.match(row, {
		onNone: () => Effect.fail(new NotFound({ message: "Note not found" })),
		onSome: Effect.succeed,
	});
});
