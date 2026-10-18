import { Config, Effect, Layer, Option, Redacted } from "effect";
import { HttpStaticServer } from "effect/http";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/client.ts";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/platform/server/better-auth/mount.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedUserLayer } from "@shivaedev/platform/server/rpc-server/session.ts";
import { Notes } from "#notes.ts";
import { authOptions } from "#server/authOptions.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { jobDashboard } from "#server/jobDashboard.ts";
import { NotesService } from "#server/NotesService.ts";
import { noteProducer } from "#server/noteProducer.ts";

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.of({
			"notes.create": (input) => Effect.flatMap(SessionUser, ({ id }) => service.create(input, id)),
			"notes.delete": (input) => Effect.flatMap(SessionUser, ({ id }) => service.delete(input, id)),
			"notes.get": (input) => Effect.flatMap(SessionUser, ({ id }) => service.get(input.id, id)),
			"notes.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id)),
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
					const { auth, routes } = yield* betterAuthMount({
						...authOptions(pool),
						...(config?.secret === undefined ? {} : { secret: Redacted.value(config.secret) }),
					});
					const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
					const sessions = {
						origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
							headers.origin === undefined
							|| headers.origin === Option.match(publicUrl, { onNone: () => `http://${headers.host}`, onSome: (url) => url.origin }),
						provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
					};
					const producer = noteProducer(Redacted.value(databaseUrl), false, config?.jobsClientFactory);
					return {
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: Notes,
						handlers: Layer.mergeAll(
							handlers,
							authenticatedUserLayer(sessions),
							routes,
							jobDashboard(databaseUrl, sessions),
							HttpStaticServer.layer({ root: "dist", spa: true }),
						),
						services: NotesService.layer.pipe(Layer.provideMerge(producer)),
						sessions,
					};
				}),
			});
		}),
	);
}
