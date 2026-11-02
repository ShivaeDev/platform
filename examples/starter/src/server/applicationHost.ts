import { Config, Effect, Layer, Option, Redacted } from "effect";
import { HttpServerRespondable, HttpStaticServer } from "effect/http";
import { adminDocuments } from "@shivaedev/admin/server/adminDocuments.ts";
import { accountRoleSeed } from "@shivaedev/identity/server/better-auth/accountRoleSeed.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { ProviderAccounts } from "@shivaedev/identity/server/better-auth/allowedAccounts.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { AppAccess } from "#AppAccess.ts";
import { Owner } from "#roles/Owner.ts";
import { User } from "#roles/User.ts";
import { AuthEmailQueue } from "#server/AuthEmailQueue.ts";
import { readyAuth } from "#server/adapters/readyAuth.ts";
import { authEmailRoutes } from "#server/authEmailRoutes.ts";
import { authEmails } from "#server/authEmails.ts";
import { authOptions } from "#server/authOptions.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";
import { jobsLayer } from "./jobsLayer.ts";
import { serverModules } from "./modules.ts";
import type { PoolSizes } from "./PoolSizes.ts";

const ownerSeed = accountRoleSeed(AppAccess, Owner.name, Config.schema(ProviderAccounts, "AUTH_OWNER_ACCOUNTS").pipe(Config.withDefault([])));

function adminDocumentRoutes() {
	return Layer.unwrap(
		Effect.map(HttpStaticServer.make({ root: "dist", spa: true }), (spa) =>
			adminDocuments(serverModules.admin, () => spa.pipe(Effect.catch(HttpServerRespondable.toResponse))),
		),
	);
}

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
			const producers = Layer.merge(serverModules.services, AuthEmailQueue.producerLayer);
			const services = producers
				.pipe(Layer.provide(jobsLayer(databaseUrl, config?.poolSizes?.jobs)))
				.pipe(Layer.provideMerge(Layer.merge(JobsClientFactory.layer, replacements)), Layer.merge(replacements));
			return appHost({
				...database,
				application: Effect.gen(function* () {
					const serviceContext = yield* Layer.build(services);
					const { routes, sessions: authSessions } = yield* betterAuthMount(
						{
							...authOptions(),
							database: yield* betterAuthDatabase(),
							...(config?.secret === undefined ? {} : { secret: Redacted.value(config.secret) }),
						},
						{
							defaultRole: User.name,
							emails: yield* authEmails().pipe(Effect.provideContext(serviceContext)),
							roleSeed: ownerSeed,
							roles: AppAccess,
						},
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
						browserErrors: { includeUserId: true, log: true, requireSession: true },
						config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
						group: modules.group,
						handlers: Layer.merge(modules.handlers, authenticatedUserLayer()),
						routes: Layer.mergeAll(routes, authEmailRoutes, HttpStaticServer.layer({ root: "dist", spa: true }), adminDocumentRoutes()),
						services: Layer.succeedContext(serviceContext),
						sessions: Layer.succeed(SessionPolicy, sessions),
					};
				}),
			}).pipe(Layer.provide(memoryStore));
		}),
	);
}
