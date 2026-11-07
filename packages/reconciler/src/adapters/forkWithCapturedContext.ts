import { Effect, type Fiber } from "effect";

export function forkWithCapturedContext<R>() {
	return Effect.fnUntraced(function* () {
		const lifetime = yield* Effect.scope;
		const context = yield* Effect.context<R>();
		const fork: <A, E>(effect: Effect.Effect<A, E, R>) => Effect.Effect<Fiber.Fiber<A, E>> = (effect) =>
			Effect.forkIn(effect.pipe(Effect.provideContext(context)), lifetime);
		return fork;
	})();
}
