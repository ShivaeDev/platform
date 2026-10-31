import { Config, Effect, Layer, Option, Redacted } from "effect";
import { HttpStaticServer } from "effect/http";
import { JobsPermission, UsersPermission } from "@shivaedev/admin/permissions.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import { SessionsPermission } from "@shivaedev/identity/sessionPermissions.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { AppAccess } from "#AppAccess.ts";
import { StatisticsPermission } from "#appPermissions.ts";
import { readyAuth } from "#server/adapters/readyAuth.ts";
import { authOptions } from "#server/authOptions.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";
import { jobsLayer } from "./jobsLayer.ts";
import { serverModules } from "./modules.ts";
import type { PoolSizes } from "./PoolSizes.ts";

export function applicationHost<R = never, E = never, TRequirements = never>(config?: {
	readonly poolSizes?: PoolSizes;
	readonly replacements?: Layer.Layer<R, E, TRequirements>;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly port?: number;
	readonly secret?: Redacted.Redacted<string>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const publicOrigin = yield* Config.URL("PUBLIC_URL").pipe(Config.option, Effect.map(Option.map((url) => url.origin)));
			const trustedProxy = Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option));
			const database = databaseOptions(databaseUrl, "check", config?.poolSizes?.sql);
			const replacements = config?.replacements ?? Layer.empty;
			const services = serverModules.services
				.pipe(Layer.provide(jobsLayer(databaseUrl, config?.poolSizes?.jobs)))
				.pipe(Layer.provideMerge(Layer.merge(JobsClientFactory.layer, replacements)), Layer.merge(replacements));
			return appHost({
				...database,
				application: Effect.gen(function* () {
					const { routes, sessions: authSessions } = yield* betterAuthMount(
						{
							...authOptions(),
							database: yield* betterAuthDatabase(),
							...(config?.secret === undefined ? {} : { secret: Redacted.value(config.secret) }),
						},
						{ roles: AppAccess },
					).pipe(Effect.tap(({ auth }) => readyAuth(auth)));
					const modules = serverModules;
					const sessions = {
						...authSessions,
						origin: trustedOrigins({
							allow: Option.toArray(publicOrigin),
							missing: "allow",
							...(Option.isNone(publicOrigin) ? { sameOrigin: { trustedProxy } } : {}),
						}),
					};

					return {
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: modules.group,
						handlers: Layer.mergeAll(
							modules.handlers,
							authenticatedUserLayer(sessions),
							permissionLayer(JobsPermission, sessions),
							permissionLayer(UsersPermission, sessions),
							permissionLayer(SessionsPermission, sessions),
							permissionLayer(StatisticsPermission, sessions),
						),
						routes: Layer.merge(routes, HttpStaticServer.layer({ root: "dist", spa: true })),
						services,
						sessions,
					};
				}),
			});
		}),
	);
}
