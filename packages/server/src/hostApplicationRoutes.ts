import { ByteSize, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpRouter } from "effect/http";

export function hostApplicationRoutes<TError, TRequirements>(routes: Layer.Layer<never, TError, TRequirements> | undefined, bodySize: number) {
	return (routes ?? Layer.empty).pipe(
		Layer.provide(HttpRouter.middleware((effect) => Effect.provideService(effect, HttpIncomingMessage.MaxBodySize, ByteSize.bytes(bodySize))).layer),
	);
}
