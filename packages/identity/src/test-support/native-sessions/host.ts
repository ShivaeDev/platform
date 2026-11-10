import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";
import { ConfigProvider, Duration, Effect, Exit, Layer, Logger, Scope } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserWithProviderAccountsLayer } from "#server/session.ts";
import { trustedOrigins } from "#server/trustedOrigins.ts";
import { Api, diagnostic, handlers } from "#test/native-sessions/api.ts";

export const NATIVE_ORIGIN = "capacitor://localhost";
export const ANDROID_ORIGIN = "https://localhost";
export const REVALIDATION_INTERVAL = Duration.millis(50);
export const startHost = Effect.fn("NativeSessions.startHost")(function* (
	enabled: boolean,
	nativeOrigins?: readonly string[],
	trustedProxy?: string,
	siblingOrigins: readonly string[] = [],
) {
	const pool = yield* betterAuthDatabase();
	const options = {
		"baseURL": "http://127.0.0.1",
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		plugins: [admin()],
		secret: "native-session-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		trustedOrigins: [NATIVE_ORIGIN, ANDROID_ORIGIN, "http://127.0.0.1:*", ...siblingOrigins],
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, enabled ? { bearerSessions: { origins: [NATIVE_ORIGIN, ANDROID_ORIGIN] } } : {}).pipe(
		Effect.provide(memoryStore),
	);
	const activity = { available: true, lookups: 0 };
	const sessions = {
		origin: siblingOrigins.length === 0 ? () => true : trustedOrigins({ allow: siblingOrigins, missing: "allow", sameOrigin: { trustedProxy } }),
		provider: mounted.admittedSessions(
			(headers) => {
				activity.lookups += 1;
				if (!activity.available) {
					return Promise.reject(new Error("Session provider unavailable"));
				}
				return mounted.auth.api.getSession({ headers });
			},
			(headers) => mounted.auth.api.listUserAccounts({ headers }),
		),
		streamRevalidationInterval: REVALIDATION_INTERVAL,
	};
	const logs: unknown[] = [];
	const changes = yield* LiveServer.pipe(Effect.provide(liveServerLayer.pipe(Layer.provide(Reactivity.layer))));
	const receiver = yield* otlpReceiver({});
	const hostScope = yield* Scope.make();
	const stop = Scope.close(hostScope, Exit.void);
	yield* Effect.addFinalizer(() => stop);
	const context = yield* Layer.build(
		appHost({
			config: { port: 0, ...(trustedProxy === undefined ? {} : { trustedProxy }) },
			group: Api,
			handlers: handlers.pipe(Layer.provideMerge(authenticatedUserWithProviderAccountsLayer())),
			...(nativeOrigins === undefined ? {} : { nativeOrigins }),
			routes: Layer.mergeAll(
				mounted.routes,
				HttpRouter.add("GET", "/diagnostic", diagnostic.pipe(Effect.map(HttpServerResponse.text))),
				HttpRouter.add("POST", "/resync", changes.resync().pipe(Effect.map(HttpServerResponse.jsonUnsafe))),
			),
			services: Layer.succeed(LiveServer, changes),
			sessions: Layer.succeed(SessionPolicy, sessions),
		}).pipe(
			Layer.provide(
				Logger.layer([
					Logger.make(({ message }) => {
						logs.push(message);
					}),
				]),
			),
			Layer.provide(
				ConfigProvider.layer(
					ConfigProvider.fromEnv({
						env: {
							"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
							"OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
						},
					}),
				),
			),
		),
	).pipe(Scope.provide(hostScope));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The native session host needs a TCP listener");
	}
	return { activity, auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, logs, pool, receiver, stop };
});
export type Host = Effect.Success<ReturnType<typeof startHost>>;
