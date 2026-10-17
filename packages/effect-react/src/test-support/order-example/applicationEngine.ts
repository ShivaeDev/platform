import { NodeHttpClient } from "@effect/platform-node";
import { Context, Deferred, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { type Order, Orders } from "./contract.ts";
import { listenServer } from "./listenServer.ts";
import { StoryDatabase } from "./postgres.ts";
import { orderWebHandler } from "./runtime.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";

function client(url: string, token?: string) {
	return RpcClient.make(Orders).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({
				transformClient: (http) =>
					token === undefined ? http : HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
				url,
			}).pipe(Layer.provide([NodeHttpClient.layerNodeHttp, RpcSerialization.layerJson])),
		),
	);
}

export interface Screen {
	readonly close: () => Promise<void>;
	readonly container: HTMLElement;
}

export const createApplication = Effect.gen(function* () {
	const database = yield* StoryDatabase;
	const reactivity = Context.get(yield* Layer.build(Reactivity.layer), Reactivity.Reactivity);
	const changes: unknown[] = [];
	const unregister = reactivity.registerUnsafe(["orders"], () => changes.push("orders"));
	yield* Effect.addFinalizer(() => Effect.sync(unregister));
	const serviceLayer = OrderService.layer.pipe(
		Layer.provide(Layer.effect(OrdersRepository, makeOrdersRepository)),
		Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql)),
		Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity)),
	);
	const service = Context.get(yield* Layer.build(serviceLayer), OrderService);
	const sessions = new Map([
		["alice-session", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" }],
		["bob-session", { expiresAt: Number.POSITIVE_INFINITY, userId: "bob" }],
		["expired-session", { expiresAt: 0, userId: "alice" }],
	]);
	const saves = { entered: yield* Deferred.make<void>(), held: false, released: yield* Deferred.make<void>() };
	const gets = new Map<number, number>();
	const server = yield* Effect.acquireRelease(
		Effect.promise(() =>
			listenServer(
				orderWebHandler(Layer.succeed(OrderService, service), {
					beforeGet: (id) =>
						Effect.sync(() => {
							gets.set(id, (gets.get(id) ?? 0) + 1);
						}),
					beforeSave: () =>
						saves.held ? Deferred.succeed(saves.entered, undefined).pipe(Effect.andThen(Deferred.await(saves.released))) : Effect.void,
					sessions,
				}),
			),
		),
		(listener) => Effect.promise(listener.close),
	);
	yield* Effect.addFinalizer(() => Deferred.succeed(saves.released, undefined));
	const alice = yield* client(server.url, "alice-session");
	const bob = yield* client(server.url, "bob-session");
	const observations: Record<string, unknown> = {};
	return {
		alice,
		bob,
		changes,
		connect: (token?: string) => client(server.url, token),
		database,
		gets,
		observations,
		orders: new Map<string, Order>(),
		saves,
		screens: new Map<string, Screen>(),
		service,
		sessions,
		url: server.url,
	};
});
export type Application = Effect.Success<typeof createApplication>;

export function orderId(engine: Application, alias: string) {
	const order = engine.orders.get(alias);
	if (order === undefined) {
		throw new Error(`No order is seeded as ${alias}`);
	}
	return order.id;
}
