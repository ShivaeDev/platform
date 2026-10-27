import { Effect, Layer, Redacted } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { adminReadPolicies } from "#modules/notes/admin.ts";
import { Notes, notesReadPolicies } from "#modules/notes/notes.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NotesService } from "#modules/notes/server/Service.ts";
import { adminRegistration } from "./adminRegistration.ts";

const handlers = Notes.application.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.application.of({
			"notes.create": (input) => Effect.flatMap(SessionUser, ({ id }) => service.create(input, id)),
			"notes.delete": (input) => Effect.flatMap(SessionUser, ({ id }) => service.delete(input, id)),
			"notes.get": (input) => Effect.flatMap(SessionUser, ({ id }) => service.get(input.id, id)),
			"notes.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id)),
			"notes.update": (input) => Effect.flatMap(SessionUser, ({ id }) => service.update(input, id)),
			"notes.whoami": () => Effect.map(SessionUser, (user) => user),
		});
	}),
);

export const notesRegistration = {
	group: Notes.merge(adminRegistration.group),
	handlers: Layer.mergeAll(handlers, adminRegistration.handlers),
	readPolicies: { ...notesReadPolicies, ...adminReadPolicies },
	services: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) =>
		NotesService.layer.pipe(Layer.provideMerge(noteProducer(Redacted.value(url), clientFactory, max))),
};
