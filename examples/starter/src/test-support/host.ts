import { ConfigProvider, Effect, Layer, Logger, Redacted, References } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { vi } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";
import { forwardingProxy } from "#test-support/forwardingProxy.ts";

export const secret = Redacted.make("app-test-secret-with-at-least-32-characters");
export const PUBLIC_URL = "https://app.example";

export interface HostOptions {
	readonly authClientIpHeader?: string;
	readonly deployed?: boolean;
	readonly rateLimitEnabled?: boolean;
	readonly trustedProxy?: string | undefined;
}

export const startHost = Effect.fn("AppStory.startHost")(function* (options: HostOptions = {}) {
	// Better Auth keeps its in-memory rate-limit buckets at module scope.
	vi.resetModules();
	const { notesHost } = yield* Effect.promise(() => import("#server/notesHost.ts"));
	const deployed = options.deployed ?? false;
	const database = yield* PostgresTestDatabase;
	yield* Effect.scoped(migrateDatabase(database.url));
	const env: Record<string, string> = deployed ? { "HOST": "0.0.0.0", "PORT": "0", "PUBLIC_URL": PUBLIC_URL } : {};
	if (options.trustedProxy !== undefined) {
		env.TRUSTED_PROXY = options.trustedProxy;
	}
	if (options.rateLimitEnabled !== undefined) {
		env.AUTH_RATE_LIMIT_ENABLED = String(options.rateLimitEnabled);
	}
	if (options.authClientIpHeader !== undefined) {
		env.AUTH_CLIENT_IP_HEADER = options.authClientIpHeader;
	}
	const host = notesHost({ databaseUrl: database.url, secret, ...(deployed ? {} : { port: 0 }) }).pipe(
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
	);
	const logs: { level: string; message: unknown; annotations: Record<string, unknown> }[] = [];
	const logger = Logger.make((entry) => {
		logs.push({
			annotations: entry.fiber.getRef(References.CurrentLogAnnotations),
			level: entry.logLevel,
			message: entry.message,
		});
	});
	const context = yield* Layer.build(host.pipe(Layer.provideMerge(Logger.layer([logger]))));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	const upstream = `http://127.0.0.1:${server.address.port}`;
	const proxy = deployed
		? yield* Effect.acquireRelease(
				Effect.promise(() => forwardingProxy(upstream)),
				(fixture) => Effect.promise(() => fixture.close()),
			)
		: undefined;
	const baseUrl = proxy?.url ?? upstream;
	return { baseUrl, context, logs, origin: deployed ? PUBLIC_URL : baseUrl };
});

export type RunningHost = Effect.Success<ReturnType<typeof startHost>>;
