import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { starterHost } from "#server/starterHost.ts";
import { forwardingProxy } from "./forwardingProxy.ts";

export const secret = Redacted.make("starter-test-secret-with-at-least-32-characters");
export const PUBLIC_URL = "https://app.example";

export const startHost = Effect.fn("StarterStory.startHost")(function* (deployed = false) {
	const database = yield* PostgresTestDatabase;
	const host = deployed
		? starterHost({ databaseUrl: database.url, secret }).pipe(
				Layer.provide(
					ConfigProvider.layer(
						ConfigProvider.fromEnv({
							env: { "HOST": "0.0.0.0", "PORT": "0", "PUBLIC_URL": PUBLIC_URL, "TRUSTED_PROXY": "127.0.0.1" },
						}),
					),
				),
			)
		: starterHost({ databaseUrl: database.url, port: 0, secret });
	const context = yield* Layer.build(host);
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
	return { baseUrl, context, origin: deployed ? PUBLIC_URL : baseUrl };
});

export type RunningHost = Effect.Success<ReturnType<typeof startHost>>;
