import { Context, Effect, Layer, ManagedRuntime, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import type { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { Preferences } from "./privateFeature.ts";

export async function privateClient(url: string, account: "alice" | "bob") {
	const acquire = RpcClient.make(Preferences, { flatten: true });
	const Client = Context.Service<Effect.Success<typeof acquire>>("private/Client");
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", `Bearer ${account}-session`)),
		url,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const runtime = ManagedRuntime.make(Layer.effect(Client, acquire).pipe(Layer.provideMerge(protocol)));
	const client = await runtime.runPromise(Client);
	const delivered: Array<{ readonly hint: LiveHint; readonly title: string; readonly list: readonly string[] }> = [];
	runtime.runFork(
		client("preferences.$changes", {
			queries: [
				{ payload: undefined, query: "self" },
				{ payload: undefined, query: "list" },
			],
		}).pipe(
			Stream.runForEach((hint) =>
				Effect.gen(function* () {
					const title = yield* client("preferences.self", undefined);
					const list = yield* client("preferences.list", undefined);
					delivered.push({ hint, list, title });
				}),
			),
		),
	);
	return {
		close: () => runtime.dispose(),
		delivered,
		read: () => runtime.runPromise(client("preferences.self", undefined)),
		save: (title: string) => runtime.runPromise(client("preferences.save", { title }).pipe(Effect.result)),
	};
}
