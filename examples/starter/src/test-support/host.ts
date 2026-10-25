import { ConfigProvider, Effect, Layer, Logger, Redacted, References } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { vi } from "vitest";
import { makePgBossTesting } from "@shivaedev/effect-pg-boss/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";
import { testPoolSizes } from "./poolSizes.ts";

export const secret = Redacted.make("app-test-secret-with-at-least-32-characters");
export const PUBLIC_URL = "https://app.example";

export interface HostOptions {
	readonly deployed?: boolean;
	readonly trustedProxy?: string | undefined;
}

export const startHost = Effect.fn("AppStory.startHost")(function* (options: HostOptions = {}) {
	// Better Auth keeps its in-memory rate-limit buckets at module scope.
	vi.resetModules();
	const { applicationHost } = yield* Effect.promise(() => import("#server/applicationHost.ts"));
	const deployed = options.deployed ?? false;
	const jobsTesting = makePgBossTesting();
	const database = yield* PostgresTestDatabase;
	yield* Effect.scoped(migrateDatabase(database.url));
	const env: Record<string, string> = deployed ? { "HOST": "0.0.0.0", "PORT": "0", "PUBLIC_URL": PUBLIC_URL } : {};
	if (options.trustedProxy !== undefined) {
		env.TRUSTED_PROXY = options.trustedProxy;
	}
	const host = applicationHost({
		databaseUrl: database.url,
		jobsClientFactory: jobsTesting.clientFactory,
		poolSizes: testPoolSizes,
		secret,
		...(deployed ? {} : { port: 0 }),
	}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
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
		? yield* forwardingProxy(upstream, {
				headers: { host: "internal.test", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" },
			})
		: undefined;
	const baseUrl = proxy?.url ?? upstream;
	return { baseUrl, context, jobsTesting, logs, origin: deployed ? PUBLIC_URL : baseUrl };
});

export type RunningHost = Effect.Success<ReturnType<typeof startHost>>;
