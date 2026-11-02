import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { mcpRoutes } from "#routes.ts";

const sessions = Layer.succeed(SessionPolicy, {
	origin: () => true,
	provider: {
		// Signed-in callers are preconditions; OAuth is exercised by the OAuth stories.
		get: (headers) => {
			const name = headers["x-story-caller"];
			return Effect.succeed(name === undefined ? Option.none() : Option.some({ user: { email: `${name}@mcp.test`, id: name, name, role: "user" } }));
		},
	},
});

export const startServer = Effect.fnUntraced(function* <E, R>(tools: Layer.Layer<never, E, R>) {
	const context = yield* Layer.build(
		HttpRouter.serve(
			mcpRoutes({
				audiences: [{ tools }],
				name: "Request story",
				path: "/mcp",
				resourceMetadataUrl: "https://mcp.story.test/resource",
				version: "1",
			}).pipe(HttpRouter.provideRequest(sessions)),
			{ disableLogger: true },
		).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	return `http://127.0.0.1:${address.port}/mcp`;
});
