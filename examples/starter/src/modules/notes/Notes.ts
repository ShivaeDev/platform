import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { notesWire } from "#generated/modules/notes/Notes.ts";
import { Create } from "#modules/notes/server/Create.ts";
import { Delete } from "#modules/notes/server/Delete.ts";
import { Get } from "#modules/notes/server/Get.ts";
import { Import } from "#modules/notes/server/Import.ts";
import { NoteJobs } from "#modules/notes/server/jobs.ts";
import { List } from "#modules/notes/server/List.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { NoteSource } from "#modules/notes/server/Source.ts";
import { Update } from "#modules/notes/server/Update.ts";

export const Notes = defineModule({
	middleware: AuthenticatedUser,
	name: "notes",
	operations: [List, Get, Create, Import, Update, Delete],
	requires: [NotesRepository, NoteJobs, NoteSource, Store, SqlClient.SqlClient, Reactivity.Reactivity],
	wire: notesWire,
});
