import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { NoteRow, notes } from "#test/notes/model.ts";

export const NotesRepository = defineRepository({
	id: "@shivaedev/test-kits/test/NotesRepository",
	initialize: makeRepository(NoteRow, { collection: notes, idColumn: "id", spanPrefix: "Notes", tableName: "notes" }),
});
