import { Config, Effect, Layer, Redacted } from "effect";
import { HttpStaticServer } from "effect/http";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/client.ts";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { AppChanges, appHost } from "@shivaedev/platform/server/appHost.ts";
import { authenticatedUserLayer } from "@shivaedev/platform/server/rpc-server/session.ts";
import { Notes, Subscribe } from "#notes.ts";
import { authDatabase } from "#server/authDatabase.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { makeAuth } from "#server/makeAuth.ts";
import { NotesService } from "#server/NotesService.ts";
import { noteProducer } from "#server/noteProducer.ts";

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
	readonly jobsClientFactory?: PgBossClientFactory;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly port?: number;
	readonly secret?: Redacted.Redacted<string>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const pool = yield* authDatabase(databaseUrl);
			const database = databaseOptions(pool, databaseUrl);
			return appHost({
				...database,
				application: Effect.gen(function* () {
					const { routes, sessions } = yield* makeAuth({ database: pool, ...(config?.secret === undefined ? {} : { secret: config.secret }) });
					const producer = noteProducer(Redacted.value(databaseUrl), false, config?.jobsClientFactory);
					return {
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: Notes,
						handlers: Layer.mergeAll(handlers, authenticatedUserLayer(sessions), routes, HttpStaticServer.layer({ root: "dist", spa: true })),
						services: NotesService.layer.pipe(Layer.provideMerge(producer)),
						sessions,
					};
				}),
			});
		}),
	);
}
