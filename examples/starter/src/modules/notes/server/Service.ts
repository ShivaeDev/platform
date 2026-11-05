import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { canReadNote } from "./canRead.ts";
import { createNote } from "./create.ts";
import { deleteNote } from "./delete.ts";
import { getNote } from "./get.ts";
import { importNote } from "./import.ts";
import { NoteJobs } from "./jobs.ts";
import { listNotes } from "./list.ts";
import { makeNotesRepository } from "./makeRepository.ts";
import { NoteSource } from "./Source.ts";
import { updateNote } from "./update.ts";

export const NotesService = defineService({
	id: "app/NotesService",
	initialize: makeNotesRepository,
	methods: (repository) => ({
		canRead: canReadNote(repository),
		create: createNote(repository),
		delete: deleteNote(repository),
		get: getNote(repository),
		import: importNote(repository),
		list: listNotes(repository),
		update: updateNote(repository),
	}),
	requires: [Store, SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs, NoteSource],
});
