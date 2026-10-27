import { Context, Effect, Layer, ManagedRuntime, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { LiveOrders, Order } from "./contract.ts";

export async function processClient(url: string) {
	const acquire = RpcClient.make(LiveOrders);
	const Client = Context.Service<Effect.Success<typeof acquire>>("order-example/ProcessClient");
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", "Bearer alice-session")),
		url,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const runtime = ManagedRuntime.make(Layer.effect(Client, acquire).pipe(Layer.provideMerge(protocol)));
	const client = await runtime.runPromise(Client);
	const hints: LiveHint[] = [];
	runtime.runFork(client.subscribe({ id: 1 }).pipe(Stream.runForEach((hint) => Effect.sync(() => hints.push(hint)))));
	return {
		close: () => runtime.dispose(),
		get: () => runtime.runPromise(client["orders.get"]({ id: 1 })),
		getResult: () => runtime.runPromise(client["orders.get"]({ id: 1 }).pipe(Effect.result)),
		hints,
		save: (name: string) => runtime.runPromise(client["orders.save"](new Order({ id: 1, name, quantity: 400 })).pipe(Effect.result)),
	};
}
