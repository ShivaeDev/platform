import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer, ManagedRuntime, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Order, Orders } from "#test/postgres-example/contract.ts";
import { recorded } from "#test/postgres-example/recorded.ts";

export function processClient(url: string) {
	const registry = AtomRegistry.make();
	const connection = makeClient(Orders, {
		headers: { authorization: "Bearer alice-session" },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const runtime = ManagedRuntime.make(Layer.empty);
	const results = recorded<Order>();
	const query = connection.api.get.query({ id: 1 });
	runtime.runFork(
		AtomRegistry.toStream(registry, query).pipe(
			Stream.filter(AsyncResult.isSuccess),
			Stream.runForEach((result) => Effect.sync(() => results.push(result.value))),
		),
	);
	return {
		close: () => runtime.dispose().finally(() => registry.dispose()),
		results,
		save: (name: string) =>
			runtime.runPromise(
				AtomRegistry.getResult(
					registry,
					connection.Client.runtime.atom(connection.api.save.run(new Order({ id: 1, name, quantity: 400 })).pipe(Effect.result)),
				),
			),
	};
}
