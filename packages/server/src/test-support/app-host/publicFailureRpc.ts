import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";

const PublicFailure = Schema.Struct({
	items: Schema.Array(Schema.Number),
	nested: Schema.Unknown,
	note: Schema.String,
	wide: Schema.Record(Schema.String, Schema.String),
});
export const publicFailureRpc = RpcGroup.make(Rpc.make("publicFailure", { error: PublicFailure, payload: PublicFailure, success: Schema.Void }));

export function callPublicFailure(url: string, payload: typeof PublicFailure.Type) {
	const protocol = RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcClient.make(publicFailureRpc);
			return yield* client.publicFailure(payload).pipe(Effect.result);
		}).pipe(Effect.provide(protocol), Effect.scoped),
	);
}
