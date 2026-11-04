import { Clock, Effect } from "effect";

export function withControlledDate<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			// Better Auth and JOSE read JavaScript dates outside the Effect runtime.
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					const original = globalThis.Date;
					globalThis.Date = new Proxy(original, {
						apply: () => new original(clock.currentTimeMillisUnsafe()).toString(),
						construct: (target, args) => Reflect.construct(target, args.length === 0 ? [clock.currentTimeMillisUnsafe()] : args),
						get: (target, property, receiver) =>
							property === "now" ? () => clock.currentTimeMillisUnsafe() : Reflect.get(target, property, receiver),
					});
					return original;
				}),
				(original) =>
					Effect.sync(() => {
						globalThis.Date = original;
					}),
			);
			return yield* effect;
		}),
	);
}
