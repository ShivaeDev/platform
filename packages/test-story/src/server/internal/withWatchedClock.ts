import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { watchedClock } from "#watchedClock.ts";

export function withWatchedClock<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Clock.clockWith((clock) =>
		"adjust" in clock ? Effect.flatMap(watchedClock, (watched) => Effect.provideService(effect, Clock.Clock, watched)) : effect,
	);
}
