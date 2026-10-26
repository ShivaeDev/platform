import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { workRpcs } from "@shivaedev/work-board/rpc/contract.ts";

function makeClient() {
	return RpcClient.make(workRpcs, { flatten: true });
}

export function supervisorBoardCall<A, E>(port: number, read: (client: Effect.Success<ReturnType<typeof makeClient>>) => Effect.Effect<A, E>) {
	return Effect.scoped(Effect.flatMap(makeClient(), read)).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_board/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			),
		),
	);
}
