import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { healthLayer } from "#host/healthLayer.ts";
import { statusLayer } from "#host/statusLayer.ts";
import type { createEngine } from "#test/createEngine.ts";

export function enginePublicationLayer(runtime: EffectRuntime, root: string) {
	return statusLayer(root, Effect.succeed({ concurrency: 8, staleAfterMs: 60_000 })).pipe(
		Layer.provideMerge(healthLayer(root)),
		Layer.provideMerge(runtime.fleetLayer),
		Layer.provide(NodeServices.layer),
	);
}
type EffectRuntime = Effect.Success<ReturnType<typeof createEngine<unknown>>>;
