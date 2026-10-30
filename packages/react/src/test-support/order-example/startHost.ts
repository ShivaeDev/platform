import { Context, Effect, Layer, Option, type Redacted } from "effect";
import { Cookies, type Headers, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { Orders } from "./contract.ts";
import { migrations } from "./postgres.ts";
import { type OrderServerOptions, orderHandlers } from "./runtime.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";

export function signedInSessions() {
	// Sign-in is a precondition; identity owns authentication and request context.
	return new Map([
		["alice-session", { user: { id: "alice" } }],
		["bob-session", { user: { id: "bob" } }],
	]);
}

export const startHost = Effect.fn("Orders.startHost")(function* (
	databaseUrl: Redacted.Redacted<string>,
	sessions: ReturnType<typeof signedInSessions>,
	options: OrderServerOptions = {},
) {
	const context = yield* Layer.build(
		appHost({
			config: { databaseUrl, port: 0 },
			group: Orders,
			handlers: orderHandlers(options),
			migrations,
			services: OrderService.layer.pipe(Layer.provide(Layer.effect(OrdersRepository, makeOrdersRepository))),
			sessions: {
				origin: () => true,
				provider: {
					get: (headers: Headers.Headers) =>
						Effect.sync(() => Option.fromUndefinedOr(sessions.get(Cookies.parseHeader(headers.cookie ?? "")["order-session"] ?? ""))),
				},
			},
		}),
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	return { context, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
