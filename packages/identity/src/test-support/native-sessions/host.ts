import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Exit, Layer, Logger, Scope, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { AppChanges, appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { Api, diagnostic, handlers } from "./api.ts";

export const NATIVE_ORIGIN = "capacitor://localhost";
export const ANDROID_ORIGIN = "https://localhost";
export const startHost = Effect.fn("NativeSessions.startHost")(function* (
	enabled: boolean,
	nativeOrigins?: readonly string[],
	trustedProxy?: string,
) {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const options = {
		"baseURL": "http://127.0.0.1",
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		plugins: [admin(), testUtils()],
		secret: "native-session-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		trustedOrigins: [NATIVE_ORIGIN, ANDROID_ORIGIN, "http://127.0.0.1:*"],
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, enabled ? { bearerSessions: { origins: [NATIVE_ORIGIN, ANDROID_ORIGIN] } } : {});
	const activity = { lookups: 0 };
	const sessions = {
		origin: () => true,
		provider: mounted.admittedSessions((headers) => {
			activity.lookups += 1;
			return mounted.auth.api.getSession({ headers });
		}),
		streamRevalidationInterval: "50 millis" as const,
	};
	const logs: unknown[] = [];
	const changes = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
	const streams = { released: 0, waiters: new Set<() => void>() };
	function streamReleased() {
		streams.released += 1;
		for (const waiter of streams.waiters) {
			waiter();
		}
	}
	const receiver = yield* otlpReceiver({});
	const hostScope = yield* Scope.make();
	const stop = Scope.close(hostScope, Exit.void);
	yield* Effect.addFinalizer(() => stop);
	const context = yield* Layer.build(
		appHost({
			config: { port: 0, ...(trustedProxy === undefined ? {} : { trustedProxy }) },
			group: Api,
			handlers: handlers.pipe(Layer.provideMerge(authenticatedUserLayer(sessions))),
			...(nativeOrigins === undefined ? {} : { nativeOrigins }),
			routes: Layer.mergeAll(
				mounted.routes,
				HttpRouter.add("GET", "/diagnostic", diagnostic.pipe(Effect.map(HttpServerResponse.text))),
				HttpRouter.add("POST", "/resync", changes.resync.pipe(Effect.map(HttpServerResponse.jsonUnsafe))),
			),
			services: Layer.succeed(AppChanges, {
				...changes,
				subscribe: (subscription, requestContext) =>
					changes.subscribe(subscription, requestContext).pipe(Stream.ensuring(Effect.sync(streamReleased))),
			}),
			sessions,
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
	return { activity, auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, logs, pool, receiver, stop, streams };
});
export type Host = Effect.Success<ReturnType<typeof startHost>>;
