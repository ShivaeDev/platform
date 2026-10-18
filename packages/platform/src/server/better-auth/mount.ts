import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Pool, type PoolClient } from "pg";
import { trustedProxyPeer, trustedProxyRanges } from "#server/rpc-server/local.ts";

export const betterAuthMount = Effect.fn("Platform.betterAuthMount")(function* <const TOptions extends BetterAuthOptions>(options: TOptions) {
	const secret = options.secret ?? Redacted.value(yield* Config.Redacted("BETTER_AUTH_SECRET"));
	const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
	const origin = Option.map(publicUrl, (url) => url.origin);
	const trustedProxy = Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option));
	const clientIpHeader = yield* Config.String("AUTH_CLIENT_IP_HEADER").pipe(Config.withDefault("x-forwarded-for"));
	const rateLimitEnabled = yield* Config.Boolean("AUTH_RATE_LIMIT_ENABLED").pipe(Config.withDefault(true));
	const isTrustedProxy = trustedProxyPeer(trustedProxy);
	const trustedProxies = trustedProxyRanges(trustedProxy);
	const auth = betterAuth({
		...options,
		advanced: {
			useSecureCookies: Option.isSome(publicUrl) && publicUrl.value.protocol === "https:",
			...options.advanced,
			ipAddress: {
				...options.advanced?.ipAddress,
				ipAddressHeaders: trustedProxies.length === 0 ? [] : [clientIpHeader],
				trustedProxies,
			},
		},
		"baseURL": options.baseURL ?? Option.getOrElse(origin, () => ({ allowedHosts: ["127.0.0.1:*"], protocol: "http" as const })),
		rateLimit: { ...options.rateLimit, enabled: rateLimitEnabled },
		secret,
		trustedOrigins: options.trustedOrigins ?? [Option.getOrElse(origin, () => "http://127.0.0.1:*")],
	});
	const routes = HttpRouter.use((router) =>
		router.add("*", "/api/auth/*", (request) =>
			Effect.gen(function* () {
				const web = yield* HttpServerRequest.toWeb(request);
				if (!Option.exists(request.remoteAddress, isTrustedProxy)) {
					web.headers.delete("x-forwarded-for");
					web.headers.delete(clientIpHeader);
				}
				return HttpServerResponse.fromWeb(yield* Effect.tryPromise(() => auth.handler(web)));
			}).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.text("Authentication is temporarily unavailable", { status: 503 })))),
		),
	);
	return { auth, routes };
});

export const authDatabase = Effect.fn("Platform.authDatabase")(function* (url: Redacted.Redacted<string>) {
	const clients = new Set<PoolClient>();
	const run = Effect.runForkWith(yield* Effect.context<never>());
	return yield* Effect.acquireRelease(
		Effect.sync(() => {
			const pool = new Pool({ connectionString: Redacted.value(url) });
			pool.on("connect", (client) => clients.add(client));
			pool.on("remove", (client) => clients.delete(client));
			pool.on("error", (error) => {
				run(Effect.logDebug({ event: "auth_database_idle_client_failed", message: error.message }));
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
