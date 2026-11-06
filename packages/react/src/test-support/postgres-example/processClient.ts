import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, ManagedRuntime, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { Order, Orders } from "./contract.ts";
import { recorded } from "./recorded.ts";

export async function processClient(url: string) {
	const connection = makeClient(Orders, {
		group: Orders,
		headers: { authorization: "Bearer alice-session" },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const runtime = ManagedRuntime.make(connection);
	const client = await runtime.runPromise(connection.Client);
	const hints = recorded<QueryUpdate>();
	runtime.runFork(
		client("orders.$changes", { queries: [{ payload: { id: 1 }, query: "get" }] }).pipe(
			Stream.runForEach((hint) => Effect.sync(() => hints.push(hint))),
		),
	);
	return {
		close: () => runtime.dispose(),
		get: () => runtime.runPromise(client("orders.get", { id: 1 })),
		getResult: () => runtime.runPromise(client("orders.get", { id: 1 }).pipe(Effect.result)),
		hints,
		save: (name: string) => runtime.runPromise(client("orders.save", new Order({ id: 1, name, quantity: 400 })).pipe(Effect.result)),
	};
}
