import { Effect, Layer, Redacted } from "effect";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { Notes } from "#modules/notes/notes.ts";
import { noteProducer } from "./producer.ts";
import { NotesService } from "./Service.ts";

const handlers = Notes.omit("notes.$changes").toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.omit("notes.$changes").of({
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
	group: Notes,
	handlers,
	services: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory) =>
		NotesService.layer.pipe(Layer.provideMerge(noteProducer(Redacted.value(url), false, clientFactory))),
};
