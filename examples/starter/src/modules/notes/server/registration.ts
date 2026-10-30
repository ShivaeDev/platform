import { resolve } from "node:path";
import { Effect, Layer, Redacted } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NoteReadAccess, Notes } from "#modules/notes/notes.ts";
import { jsonPlaceholderNotes } from "#modules/notes/server/adapters/jsonPlaceholder.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesService } from "#modules/notes/server/Service.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { adminRegistration } from "./adminRegistration.ts";

const handlers = Notes.application.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.application.of({
			"notes.create": (input) => Effect.flatMap(SessionUser, ({ id }) => service.create(input, id)),
			"notes.delete": (input) => Effect.flatMap(SessionUser, ({ id }) => service.delete(input, id)),
			"notes.get": (input) => Effect.flatMap(SessionUser, ({ id }) => service.get(input.id, id)),
			"notes.import": (input) => Effect.flatMap(SessionUser, ({ id }) => service.import(input, id)),
			"notes.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id)),
			"notes.update": (input) => Effect.flatMap(SessionUser, ({ id }) => service.update(input, id)),
			"notes.whoami": () => Effect.map(SessionUser, (user) => user),
		});
	}),
);

export const notesRegistration = {
	group: Notes.merge(adminRegistration.group),
	handlers: Layer.mergeAll(handlers, adminRegistration.handlers),
	migrations: resolve(import.meta.dirname, "migrations"),
	services: (url: Redacted.Redacted<string>, max?: number) =>
		Layer.effect(
			NoteReadAccess,
			Effect.map(NotesService, (service) => (id, userId) => service.canRead(id, userId).pipe(Effect.catch(() => Effect.succeed(false)))),
		).pipe(
			Layer.provideMerge(NotesService.layer.pipe(Layer.provide(jsonPlaceholderNotes))),
			Layer.provideMerge(Layer.unwrap(Effect.map(JobsClientFactory, (factory) => noteProducer(Redacted.value(url), factory, max)))),
		),
};
