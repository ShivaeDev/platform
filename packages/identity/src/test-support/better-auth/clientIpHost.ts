import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { ConfigProvider, Effect, Layer, Option } from "effect";
import { Headers, HttpRouter, HttpServer, HttpServerRequest } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { recorder } from "#test/rpc/harness.ts";

export const clientIpHost = Effect.fn("ClientIpStory.clientIpHost")(function* (env: Record<string, string>) {
	const recorded = recorder();
	const pool = yield* betterAuthDatabase();
	const options = {
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		rateLimit: { customRules: { "/sign-in/email": { max: 2, window: 60 } }, storage: "database" },
		secret: "client-ip-story-secret-with-at-least-32-characters",
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const context = yield* Effect.gen(function* () {
		const mounted = yield* betterAuthMount(options);
		return yield* Layer.build(
			HttpRouter.serve(Layer.merge(mounted.routes, storyPeer)).pipe(
				Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
				Layer.provide(recorded.layer),
			),
		);
	}).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The client IP story needs a TCP listener");
	}
	return { baseUrl: `http://127.0.0.1:${server.address.port}`, pool, spans: recorded.spans };
});

export const STORY_PEER_HEADER = "x-story-peer";

// A second client address needs no second loopback address, which macOS lacks without an alias.
const storyPeer = HttpRouter.middleware(
	(effect) =>
		Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
			const peer = request.headers[STORY_PEER_HEADER];
			return peer === undefined
				? effect
				: Effect.provideService(
						effect,
						HttpServerRequest.HttpServerRequest,
						request.modify({ headers: Headers.remove(request.headers, STORY_PEER_HEADER), remoteAddress: Option.some(peer) }),
					);
		}),
	{ global: true },
);
