import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";
import { CatalogClock } from "#server/clocks.ts";

export const withCatalogClock = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const clock = yield* TestClock.make();
	return yield* effect.pipe(
		Effect.provideService(CatalogClock, {
			deadline: (duration) => clock.sleep(Duration.fromInputUnsafe(duration)),
			pause: (duration) => clock.adjust(duration),
		}),
	);
});
