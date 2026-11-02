import { resolve } from "node:path";
import { Effect, Layer } from "effect";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { Create, Delete, Get, Import, List, NoteReadAccess, Notes, Update } from "#modules/notes/notes.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/adapters/jsonPlaceholder.ts";
import { adminRegistration } from "#modules/notes/server/admin/registration.ts";
import { CountWords } from "#modules/notes/server/jobs.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesService } from "#modules/notes/server/Service.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };

const handlers = Notes.application.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.application.of({
			"notes.create": (input) => Effect.flatMap(SessionUser, ({ id }) => service.create(input, id).pipe(rpcBoundary(Create.error, boundaryOptions))),
			"notes.delete": (input) => Effect.flatMap(SessionUser, ({ id }) => service.delete(input, id).pipe(rpcBoundary(Delete.error, boundaryOptions))),
			"notes.get": (input) => Effect.flatMap(SessionUser, ({ id }) => service.get(input.id, id).pipe(rpcBoundary(Get.error, boundaryOptions))),
			"notes.import": (input) => Effect.flatMap(SessionUser, ({ id }) => service.import(input, id).pipe(rpcBoundary(Import.error, boundaryOptions))),
			"notes.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id).pipe(rpcBoundary(List.error, boundaryOptions))),
			"notes.update": (input) => Effect.flatMap(SessionUser, ({ id }) => service.update(input, id).pipe(rpcBoundary(Update.error, boundaryOptions))),
		});
	}),
);

export const notesRegistration = {
	...adminRegistration,
	group: Notes.merge(adminRegistration.group),
	handlers: Layer.mergeAll(handlers, adminRegistration.handlers),
	migrations: resolve(import.meta.dirname, "migrations"),
	queues: [CountWords],
	services<R, E, TRequirements>(replacements: Layer.Layer<R, E, TRequirements>) {
		const ports = Layer.mergeAll(jsonPlaceholderNotes, memoryStore, noteProducer).pipe(Layer.provide(replacements), Layer.merge(replacements));
		const services = NotesService.layer.pipe(Layer.provideMerge(ports), Layer.merge(replacements));
		return Layer.effect(
			NoteReadAccess,
			Effect.map(NotesService, (service) => (id, userId) => service.canRead(id, userId).pipe(rpcBoundary(Get.error, boundaryOptions))),
		).pipe(Layer.provideMerge(services), Layer.merge(replacements));
	},
};
