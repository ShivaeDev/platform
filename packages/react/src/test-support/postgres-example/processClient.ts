import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, ManagedRuntime, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { LiveOrders, Order, Orders } from "./contract.ts";

export async function processClient(url: string) {
	const connection = makeClient(Orders, {
		group: LiveOrders,
		headers: { authorization: "Bearer alice-session" },
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const runtime = ManagedRuntime.make(connection);
	const client = await runtime.runPromise(connection.Client);
	const hints: LiveHint[] = [];
	runtime.runFork(client("subscribe", { id: 1 }).pipe(Stream.runForEach((hint) => Effect.sync(() => hints.push(hint)))));
	return {
		close: () => runtime.dispose(),
		get: () => runtime.runPromise(client("orders.get", { id: 1 })),
		getResult: () => runtime.runPromise(client("orders.get", { id: 1 }).pipe(Effect.result)),
		hints,
		save: (name: string) => runtime.runPromise(client("orders.save", new Order({ id: 1, name, quantity: 400 })).pipe(Effect.result)),
	};
}
