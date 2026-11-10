import { Effect, Layer } from "effect";
import type { RpcClient } from "effect/rpc";

export const withClientProtocol = Effect.fn("RpcClient.withClientProtocol")(function* <A, E, R, TMakeError, TMakeRequirements>(
	protocol: Layer.Layer<RpcClient.Protocol, E, R>,
	make: Effect.Effect<A, TMakeError, TMakeRequirements>,
) {
	const context = yield* Layer.build(protocol);
	return yield* Effect.provideContext(make, context);
});
