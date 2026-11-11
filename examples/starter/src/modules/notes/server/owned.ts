import { Effect, Option } from "effect";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const ownedNote = Effect.fn("Notes.ownedNote")(function* (id: number) {
	const repository = yield* NotesRepository;
	const { id: userId } = yield* SessionUser;
	const row = yield* repository.findOne({ where: { id, userId } });
	return yield* Option.match(row, {
		onNone: () => Effect.fail(new NotFound({ message: "Note not found" })),
		onSome: Effect.succeed,
	});
});
