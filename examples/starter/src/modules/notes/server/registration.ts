import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { rpcBoundaryHandlers } from "@shivaedev/errors/rpcBoundaryHandlers.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { Notes } from "#modules/notes/notes.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/adapters/jsonPlaceholder.ts";
import { adminRegistration } from "#modules/notes/server/admin/registration.ts";
import { createNote } from "#modules/notes/server/create.ts";
import { deleteNote } from "#modules/notes/server/delete.ts";
import { getNote } from "#modules/notes/server/get.ts";
import { importNote } from "#modules/notes/server/import.ts";
import { listNotes } from "#modules/notes/server/list.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";
import { updateNote } from "#modules/notes/server/update.ts";
import { notesWorker } from "#modules/notes/server/worker.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };

const handlers = Notes.application.toLayer(
	rpcBoundaryHandlers(Notes.application, boundaryOptions, {
		"notes.create": createNote,
		"notes.delete": deleteNote,
		"notes.get": ({ id }) => getNote(id),
		"notes.import": importNote,
		"notes.list": listNotes,
		"notes.update": updateNote,
	}),
);

export const notesRegistration = {
	admin: adminRegistration,
	group: Notes,
	handlers,
	migrations: {
		loader: Effect.flatMap(Path.Path, (path) => MigratorFileSystem.fromFileSystem(path.join(import.meta.dirname, "migrations"))).pipe(
			Effect.provide(NodeServices.layer),
		),
	},
	name: "notes",
	ports: Layer.mergeAll(jsonPlaceholderNotes, memoryStore, noteProducer),
	queues: notesWorker.queues,
	services: NotesRepository.layer,
	workers: notesWorker.workers,
} satisfies AppModule;
