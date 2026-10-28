import { Config, Effect, Layer, Option, Redacted } from "effect";
import { HttpStaticServer } from "effect/http";
import { JobsPermission, UsersPermission } from "@shivaedev/admin/permissions.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { AppAccess } from "#AppAccess.ts";
import { StatisticsPermission } from "#appPermissions.ts";
import { authOptions } from "#server/authOptions.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { serverModules } from "./modules.ts";
import type { PoolSizes } from "./PoolSizes.ts";

export function applicationHost(config?: {
	readonly poolSizes?: PoolSizes;
	readonly jobsClientFactory?: PgBossClientFactory;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly port?: number;
	readonly secret?: Redacted.Redacted<string>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const pool = yield* authDatabase(databaseUrl, { max: config?.poolSizes?.auth });
			const database = databaseOptions(pool, databaseUrl, "check", config?.poolSizes?.sql);
			return appHost({
				...database,
				application: Effect.gen(function* () {
					const { routes, sessions: authSessions } = yield* betterAuthMount(
						{
							...authOptions(pool),
							...(config?.secret === undefined ? {} : { secret: Redacted.value(config.secret) }),
						},
						{ roles: AppAccess },
					);
					const modules = serverModules;
					const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
					const sessions = {
						...authSessions,
						origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
							headers.origin === undefined
							|| headers.origin === Option.match(publicUrl, { onNone: () => `http://${headers.host}`, onSome: (url) => url.origin }),
					};

					return {
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: modules.group,
						handlers: Layer.mergeAll(
							modules.handlers,
							authenticatedUserLayer(sessions),
							permissionLayer(JobsPermission, sessions),
							permissionLayer(UsersPermission, sessions),
							permissionLayer(StatisticsPermission, sessions),
						),
						routes: Layer.merge(routes, HttpStaticServer.layer({ root: "dist", spa: true })),
						services: modules.services(databaseUrl, config?.jobsClientFactory, config?.poolSizes?.jobs),
						sessions,
					};
				}),
			});
		}),
	);
}
