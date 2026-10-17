import { Config, Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/http";
import { AppChanges, appHost } from "@shivaedev/platform/appHost.ts";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { authenticatedUserLayer } from "@shivaedev/platform/rpc-server/session.ts";
import { Notes, Subscribe } from "#notes.ts";
import { makeAuth } from "./auth.ts";
import { databaseOptions } from "./databaseOptions.ts";
import { NotesService } from "./NotesService.ts";
import { noteProducer } from "./noteProducer.ts";

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		const changes = yield* AppChanges;
		return Notes.of({
			"notes.create": (input) => Effect.flatMap(SessionUser, ({ id }) => service.create(input, id)),
			"notes.delete": (input) => Effect.flatMap(SessionUser, ({ id }) => service.delete(input, id)),
			"notes.get": (input) => Effect.flatMap(SessionUser, ({ id }) => service.get(input.id, id)),
			"notes.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id)),
			"notes.subscribe": () => changes.stream(Subscribe.reads(undefined)),
			"notes.update": (input) => Effect.flatMap(SessionUser, ({ id }) => service.update(input, id)),
			"notes.whoami": () => Effect.map(SessionUser, (user) => user),
		});
	}),
);

export function notesHost(config?: {
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly port?: number;
	readonly secret?: Redacted.Redacted<string>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const { auth, routes, sessions } = yield* makeAuth({ databaseUrl, ...(config?.secret === undefined ? {} : { secret: config.secret }) });
			const database = databaseOptions(auth, databaseUrl);
			const producer = noteProducer(Redacted.value(databaseUrl));
			return appHost({
				config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
				group: Notes,
				handlers: Layer.mergeAll(
					handlers,
					authenticatedUserLayer(sessions),
					routes,
					HttpRouter.add("GET", "/health", HttpServerResponse.text("Ready")),
					HttpStaticServer.layer({ root: "dist", spa: true }),
				),
				migrations: database.migrations,
				services: NotesService.layer.pipe(Layer.provideMerge(producer)),
				sessions,
			});
		}),
	);
}
