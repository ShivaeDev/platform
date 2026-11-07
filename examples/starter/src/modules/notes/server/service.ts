import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { canReadNote } from "#modules/notes/server/canRead.ts";
import { createNote } from "#modules/notes/server/create.ts";
import { deleteNote } from "#modules/notes/server/delete.ts";
import { getNote } from "#modules/notes/server/get.ts";
import { importNote } from "#modules/notes/server/import.ts";
import { NoteJobs } from "#modules/notes/server/jobs.ts";
import { listNotes } from "#modules/notes/server/list.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { NoteSource } from "#modules/notes/server/Source.ts";
import { updateNote } from "#modules/notes/server/update.ts";

export const notesService = defineService({
	id: "app/NotesService",
	initialize: Effect.void,
	methods: () => ({
		canReadNote,
		createNote,
		deleteNote,
		getNote,
		importNote,
		listNotes,
		updateNote,
	}),
	requires: [NotesRepository, SessionUser, Store, SqlClient.SqlClient, Reactivity.Reactivity, NoteJobs, NoteSource],
});
