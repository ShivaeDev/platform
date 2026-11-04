import { connect } from "node:net";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Api } from "./feature.ts";

export function httpClient(path: string) {
	const agent = Layer.effect(
		NodeHttpClient.HttpAgent,
		Effect.map(NodeHttpClient.makeAgent({ keepAlive: true }), (agents) => {
			agents.http.createConnection = () => connect(path);
			return agents;
		}),
	);
	return Effect.gen(function* () {
		const context = yield* Layer.build(
			RpcClient.layerProtocolHttp({ url: "http://localhost/rpc" }).pipe(
				Layer.provide([NodeHttpClient.layerNodeHttpNoAgent.pipe(Layer.provide(agent)), RpcSerialization.layerNdjson]),
			),
		);
		return yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(context));
	});
}
export const liveClient = Effect.fnUntraced(function* (path: string) {
	const context = yield* Layer.build(
		RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(`ws+unix://${path}:/rpc`, { headers: {} }), RpcSerialization.layerNdjson])),
	);
	return yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(context));
});
