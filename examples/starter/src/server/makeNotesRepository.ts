import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { Note } from "#notes.ts";

export const makeNotesRepository = makeRepository(Note, {
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "starter_notes",
});
