import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";
import { ConfigProvider, Effect, Exit, Layer, Logger, Scope } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { AppChanges, appHost } from "#server/appHost.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedUserLayer } from "#server/rpc-server/session.ts";
import { Api, diagnostic, handlers } from "./api.ts";

export const NATIVE_ORIGIN = "capacitor://localhost";
export const startHost = Effect.fn("NativeSessions.startHost")(function* (enabled: boolean) {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const options = {
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		plugins: [admin()],
		secret: "native-session-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		trustedOrigins: [NATIVE_ORIGIN, "http://127.0.0.1:*"],
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, enabled ? { bearerSessions: { origins: [NATIVE_ORIGIN] } } : {});
	const sessions = {
		origin: () => true,
		provider: betterAuthSessions(mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers }))),
		streamRevalidationInterval: "50 millis" as const,
	};
	const logs: unknown[] = [];
	const receiver = yield* otlpReceiver({});
	const hostScope = yield* Scope.make();
	const stop = Scope.close(hostScope, Exit.void);
	yield* Effect.addFinalizer(() => stop);
	const context = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: handlers.pipe(Layer.provideMerge(authenticatedUserLayer(sessions))),
			routes: Layer.merge(mounted.routes, HttpRouter.add("GET", "/diagnostic", diagnostic.pipe(Effect.map(HttpServerResponse.text)))),
			services: Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provide(Reactivity.layer)),
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
	return { baseUrl: `http://127.0.0.1:${server.address.port}`, logs, pool, receiver, stop };
});
export type Host = Effect.Success<ReturnType<typeof startHost>>;
