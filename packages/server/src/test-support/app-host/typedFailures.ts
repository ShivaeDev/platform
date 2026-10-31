import { Effect, Layer, Result, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { Conflict, Forbidden } from "@shivaedev/errors/taxonomy.ts";

export const TypedFailures = RpcGroup.make(
	Rpc.make("typedFailure", {
		error: Schema.Union([Forbidden, Conflict, QueryReadDenied]),
		payload: { failure: Schema.Literals(["Forbidden", "Conflict", "QueryReadDenied"]) },
		success: Schema.Void,
	}),
);
export const typedFailureHandlers = TypedFailures.toLayer({
	typedFailure: ({ failure }) => {
		switch (failure) {
			case "Forbidden":
				return Effect.fail(new Forbidden({ message: "You cannot edit this job" }));
			case "Conflict":
				return Effect.fail(new Conflict({ message: "Name is taken" }));
			case "QueryReadDenied":
				return Effect.fail(new QueryReadDenied({ message: "You cannot read this job" }));
		}
	},
});
export function typedFailure(url: string, failure: "Forbidden" | "Conflict" | "QueryReadDenied") {
	const protocol = RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.gen(function* () {
		const client = yield* RpcClient.make(TypedFailures);
		const result = yield* client.typedFailure({ failure }).pipe(Effect.result);
		return Result.isFailure(result) ? { _tag: result.failure._tag, message: result.failure.message } : "succeeded instead of failing";
	}).pipe(Effect.provide(protocol), Effect.scoped);
}
