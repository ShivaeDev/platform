import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { type BearerSessionsOptions, sessionHeaders, withBearerSessions } from "#server/better-auth/bearerSessions.ts";
import { memoryRateLimit } from "#server/better-auth/memoryRateLimit.ts";
import { mountRoutes } from "#server/better-auth/mountRoutes.ts";
import { type RevokeUnadmitted, revokeUnadmitted } from "#server/better-auth/revokeUnadmitted.ts";
import { type PolicyStorage, type SignInPolicy, signInGate } from "#server/better-auth/signInGate.ts";
import { signInPolicyOptions } from "#server/better-auth/signInPolicy.ts";
import type { GetSession } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { trustedProxyRanges } from "#server/rpc-server/local.ts";
import type { SessionShape } from "#server/rpc-server/session.ts";
import { mountedSessions } from "./mountedSessions.ts";

export interface BetterAuthMountOptions<E = never, R = never> {
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly roles?: RoleSet;
	readonly signIn?: SignInPolicy<E, R> | undefined;
}

export const betterAuthMount = Effect.fn("Platform.betterAuthMount")(function* <const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount: BetterAuthMountOptions<E, R> = {},
) {
	const secret = options.secret ?? Redacted.value(yield* Config.Redacted("BETTER_AUTH_SECRET"));
	const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
	const origin = Option.map(publicUrl, (url) => url.origin);
	const trustedProxy = Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option));
	const clientIpHeader = yield* Config.String("AUTH_CLIENT_IP_HEADER").pipe(Config.withDefault("x-forwarded-for"));
	const rateLimitEnabled = yield* Config.Boolean("AUTH_RATE_LIMIT_ENABLED").pipe(Config.withDefault(true));
	const trustedProxies = trustedProxyRanges(trustedProxy);
	const context = yield* Effect.context<R>();
	const run = Effect.runPromiseWith(context);
	const policy = mount.signIn ?? {};
	if (policy.accounts !== undefined) {
		yield* policy.accounts;
	}
	const gate = yield* signInGate(policy);
	const gated = signInPolicyOptions(options, gate, run, (): Promise<PolicyStorage> => auth.$context);
	const rateLimit = options.rateLimit;
	const customStorage =
		rateLimit?.customStorage ?? (rateLimit?.storage === undefined || rateLimit.storage === "memory" ? yield* memoryRateLimit : undefined);
	const auth = betterAuth({
		...withBearerSessions(options, mount.bearerSessions !== undefined),
		advanced: {
			useSecureCookies: Option.isSome(publicUrl) && publicUrl.value.protocol === "https:",
			...options.advanced,
			ipAddress: {
				...options.advanced?.ipAddress,
				ipAddressHeaders: trustedProxies.length === 0 ? [] : [clientIpHeader],
				trustedProxies,
			},
		},
		"baseURL":
			options.baseURL
			?? Option.getOrElse(origin, () => ({
				allowedHosts: ["127.0.0.1:*"],
				protocol: "http" as const,
			})),
		databaseHooks: gate.active ? gated.databaseHooks : options.databaseHooks,
		rateLimit: {
			...rateLimit,
			...(customStorage === undefined ? {} : { customStorage }),
			enabled: rateLimitEnabled,
		},
		secret,
		trustedOrigins: options.trustedOrigins ?? [Option.getOrElse(origin, () => "http://127.0.0.1:*")],
		user: gate.active ? gated.user : options.user,
	});
	const authRoutes = mountRoutes(auth, {
		bearerSessions: mount.bearerSessions,
		clientIpHeader,
		roles: mount.roles,
		trustedProxy,
	});
	function admittedSessions<TSession extends SessionShape>(getSession: GetSession<TSession>): GetSession<TSession> {
		if (!gate.active && mount.bearerSessions === undefined) {
			return getSession;
		}
		return (headers) =>
			run(
				Effect.gen(function* () {
					const { authCookies } = yield* Effect.promise(() => auth.$context);
					const selected = mount.bearerSessions === undefined ? headers : sessionHeaders(headers, authCookies.sessionToken.name);
					const session = yield* Effect.tryPromise(() => getSession(selected));
					if (!gate.active || session === null) {
						return session;
					}
					const storage = yield* Effect.tryPromise(() => auth.$context);
					if (yield* gate.admitsUser(storage, session.user.id)) {
						return session;
					}
					yield* Effect.tryPromise(() => storage.internalAdapter.deleteUserSessions(session.user.id));
					yield* Effect.logInfo("The sign-in policy revoked a user's sessions").pipe(Effect.annotateLogs({ userId: session.user.id }));
					return null;
				}),
			);
	}
	const revoke: RevokeUnadmitted<E> = Effect.provideContext(
		revokeUnadmitted(gate, () => auth.$context),
		context,
	);
	const lookupSession = Reflect.get(auth.api, "getSession");
	const sessions = mountedSessions(
		(headers) => lookupSession({ asResponse: false, headers, query: { disableCookieCache: true }, returnHeaders: false }),
		admittedSessions,
		mount.roles,
	);
	return { admittedSessions, auth, revokeUnadmitted: revoke, routes: authRoutes, sessions };
});

export const authDatabase = Effect.fn("Platform.authDatabase")(function* (
	url: Redacted.Redacted<string>,
	options: Pick<PoolConfig, "max" | "application_name"> = {},
) {
	const clients = new Set<PoolClient>();
	const run = Effect.runForkWith(yield* Effect.context<never>());
	return yield* Effect.acquireRelease(
		Effect.sync(() => {
			const pool = new Pool({
				...options,
				connectionString: Redacted.value(url),
			});
			pool.on("connect", (client) => clients.add(client));
			pool.on("remove", (client) => clients.delete(client));
			pool.on("error", (error) => {
				run(
					Effect.logDebug({
						event: "auth_database_idle_client_failed",
						message: error.message,
					}),
				);
			});
			return pool;
		}),
		(pool) =>
			Effect.promise(async () => {
				// pg-pool resolves end before its clients finish disconnecting.
				const disconnected = [...clients].map((client) => new Promise<void>((resolve) => client.once("end", resolve)));
				await pool.end();
				await Promise.all(disconnected);
			}),
	);
});
