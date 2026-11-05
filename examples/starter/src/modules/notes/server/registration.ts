import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { rpcBoundaryHandlers } from "@shivaedev/errors/rpcBoundaryHandlers.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { NoteReadAccess, Notes } from "#modules/notes/notes.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/adapters/jsonPlaceholder.ts";
import { adminRegistration } from "#modules/notes/server/admin/registration.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { notesService } from "#modules/notes/server/service.ts";
import { NotesRepository } from "./Repository.ts";
import { notesWorker } from "./worker.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };

const handlers = Notes.application.toLayer(
	rpcBoundaryHandlers(Notes.application, boundaryOptions, {
		"notes.create": (input) =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.createNote(input);
			}),
		"notes.delete": (input) =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.deleteNote(input);
			}),
		"notes.get": (input) =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.getNote(input.id);
			}),
		"notes.import": (input) =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.importNote(input);
			}),
		"notes.list": () =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.listNotes();
			}),
		"notes.update": (input) =>
			Effect.gen(function* () {
				const service = yield* notesService;
				return yield* service.updateNote(input);
			}),
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
	requestServices: Layer.effect(
		NoteReadAccess,
		Effect.map(notesService, (service) => service.canReadNote),
	).pipe(Layer.provideMerge(notesService.layer)),
	services: NotesRepository.layer,
	workers: notesWorker.workers,
} satisfies AppModule;
