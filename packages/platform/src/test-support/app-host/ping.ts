import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcTest } from "effect/rpc";

export const Ping = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
export const pingHandlers = Ping.toLayer({ ping: () => Effect.succeed("pong") });

export function directPing() {
	return RpcTest.makeClient(Ping).pipe(
		Effect.flatMap((client) => client.ping()),
		Effect.provide(pingHandlers),
		Effect.scoped,
	);
}

export function ping(url: string) {
	const protocol = RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.runPromise(
		RpcClient.make(Ping).pipe(
			Effect.flatMap((client) => client.ping()),
			Effect.provide(protocol),
			Effect.scoped,
		),
	);
}
