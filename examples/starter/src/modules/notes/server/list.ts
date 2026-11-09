import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { notesSqlFailure } from "#modules/notes/server/sqlFailure.ts";

export const listNotes = Effect.fn("Notes.listNotes")(function* () {
	const repository = yield* NotesRepository;
	const { id: userId } = yield* SessionUser;
	return yield* repository
		.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title", "wordCount", "version"], where: { userId } })
		.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error))));
});
