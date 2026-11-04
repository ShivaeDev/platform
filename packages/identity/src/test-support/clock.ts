import { Clock, DateTime, Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";

export const storyClock = DateTime.makeUnsafe("2026-11-04T12:00:00Z");

export function withControlledDate<A, E, R>(effect: Effect.Effect<A, E, R>, providerTime?: () => number) {
	return Effect.scoped(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			const now = providerTime ?? (() => clock.currentTimeMillisUnsafe());
			// Better Auth reads JavaScript dates outside the Effect runtime.
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					const original = globalThis.Date;
					globalThis.Date = new Proxy(original, {
						apply: () => new original(now()).toString(),
						construct: (target, args) => Reflect.construct(target, args.length === 0 ? [now()] : args),
						get: (target, property, receiver) => (property === "now" ? now : Reflect.get(target, property, receiver)),
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

export function withIdentityDatabase<A, E, R>(effect: Effect.Effect<A, E, R>, providerTime?: () => number) {
	return withIsolatedDatabase(withControlledDate(effect, providerTime));
}
