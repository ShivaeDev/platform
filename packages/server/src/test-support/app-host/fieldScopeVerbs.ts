import { Effect, Layer, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { scoped } from "./fieldScopeApi.ts";
import type { HostState } from "./state.ts";

export function fieldScopeVerbs(state: HostState, tell: (line: string) => void) {
	return {
		readState: (method: "privateState" | "publicState", fail = false) => {
			tell(`the native HTTP RPC client calls ${method}${fail ? " and receives a rejection" : ""}`);
			const protocol = RpcClient.layerProtocolHttp({ url: `${state.url}/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			);
			return Effect.gen(function* () {
				const client = yield* RpcClient.make(scoped);
				const invocation: Effect.Effect<{ readonly state: string }, unknown> = client[method]({ fail });
				const result = yield* Effect.result(invocation);
				return Result.isFailure(result) ? { rejected: result.failure } : { received: result.success };
			}).pipe(Effect.provide(protocol), Effect.scoped);
		},
	};
}
