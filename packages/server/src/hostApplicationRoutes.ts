import { ByteSize, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpRouter } from "effect/http";
import { routeRequestLogging } from "#routeRequestLogging.ts";

export function hostApplicationRoutes<TError, TRequirements>(routes: Layer.Layer<never, TError, TRequirements> | undefined, bodySize: number) {
	return (routes ?? Layer.empty).pipe(
		Layer.provide(HttpRouter.middleware((effect) => Effect.provideService(effect, HttpIncomingMessage.MaxBodySize, ByteSize.bytes(bodySize))).layer),
		Layer.provide(routeRequestLogging.layer),
	);
}
