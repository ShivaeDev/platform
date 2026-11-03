import { Clock, Effect, Exit, Layer, Scope } from "effect";

export function clockedLayer<R, E>(layer: Layer.Layer<R, E>, clock: Clock.Clock) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const scope = yield* Effect.acquireRelease(Scope.make(), (owned) =>
				Scope.close(owned, Exit.void).pipe(Effect.provideService(Clock.Clock, clock)),
			);
			return yield* Layer.buildWithScope(layer, scope);
		}).pipe(Effect.provideService(Clock.Clock, clock)),
	).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, clock)));
}
