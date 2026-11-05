import { Effect, Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { HttpRouter } from "effect/http";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import type { McpOptions } from "./routes.ts";

export const requestServer = Effect.fn("Mcp.requestServer")(function* <E, R>(options: McpOptions<E, R>) {
	const user = yield* SessionUser;
	const tools = options.audiences
		.filter(({ permission }) => permission === undefined || hasPermission(user, permission))
		.map((audience) => audience.tools);
	const transport = McpServer.layerHttpRequestScoped({
		...options,
		protocols: [McpProtocol.v2026_07_28],
		registrations: Layer.mergeAll(Layer.empty, ...tools),
	});
	// A router built from the shared HttpRouter.layer would come back memoized as the app's own router, which already holds this path.
	const router = Layer.effect(HttpRouter.HttpRouter, HttpRouter.make);
	const handler = yield* HttpRouter.toHttpEffect(transport.pipe(Layer.provideMerge(router)));
	return yield* handler;
});
