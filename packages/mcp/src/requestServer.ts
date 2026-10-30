import { Effect, Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { HttpRouter } from "effect/http";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import type { McpOptions } from "./routes.ts";

export const requestServer = Effect.fn("Mcp.requestServer")(function* <TSession extends UserSessionShape, E, R>(options: McpOptions<TSession, E, R>) {
	const user = yield* SessionUser;
	const inner = yield* HttpRouter.make;
	const transport = McpServer.layerHttpRequestScoped({ ...options, protocols: [McpProtocol.v2026_07_28] });
	const tools = options.audiences
		.filter(({ permission }) => permission === undefined || hasPermission(user, permission))
		.map((audience) => audience.tools);
	yield* Layer.build(Layer.mergeAll(transport, ...tools)).pipe(Effect.provideService(HttpRouter.HttpRouter, inner));
	return yield* inner.asHttpEffect();
});
