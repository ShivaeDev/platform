import { Config, Effect, Layer, Option, Redacted } from "effect";
import { HttpStaticServer } from "effect/http";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/platform/server/better-auth/mount.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedUserLayer } from "@shivaedev/platform/server/rpc-server/session.ts";
import { authOptions } from "#server/authOptions.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { jobDashboard } from "#server/jobDashboard.ts";
import { serverModules } from "./modules.ts";

export function applicationHost(config?: {
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
					const modules = serverModules;
					const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
					const sessions = {
						origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
							headers.origin === undefined
							|| headers.origin === Option.match(publicUrl, { onNone: () => `http://${headers.host}`, onSome: (url) => url.origin }),
						provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
					};

					return {
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: modules.group,
						handlers: Layer.mergeAll(
							modules.handlers,
							authenticatedUserLayer(sessions),
							routes,
							jobDashboard(databaseUrl, sessions),
							HttpStaticServer.layer({ root: "dist", spa: true }),
						),
						services: modules.services(databaseUrl, config?.jobsClientFactory),
						sessions,
					};
				}),
			});
		}),
	);
}
