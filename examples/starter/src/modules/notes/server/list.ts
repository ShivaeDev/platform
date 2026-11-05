import { Effect } from "effect";
import type { NotesRepository } from "./makeRepository.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

export function listNotes(repository: NotesRepository) {
	return Effect.fn("NotesService.list")((userId: string) =>
		repository
			.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title", "wordCount", "version"], where: { userId } })
			.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(notesSqlFailure(error)))),
	);
}
