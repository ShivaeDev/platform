import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { canReadNote } from "./canRead.ts";
import { createNote } from "./create.ts";
import { deleteNote } from "./delete.ts";
import { getNote } from "./get.ts";
import { importNote } from "./import.ts";
import { NoteJobs } from "./jobs.ts";
import { listNotes } from "./list.ts";
import { NotesRepository } from "./Repository.ts";
import { NoteSource } from "./Source.ts";
import { updateNote } from "./update.ts";

export const notesService = defineService({
	id: "app/NotesService",
	initialize: Effect.void,
	methods: () => ({
		canRead: canReadNote,
		create: createNote,
		delete: deleteNote,
		get: getNote,
		import: importNote,
		list: listNotes,
		update: updateNote,
	}),
	requires: [NotesRepository, SessionUser, Store, SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs, NoteSource],
});
