import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { watchedClock } from "#server/watchedClock.ts";

export function withWatchedClock<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(watchedClock, (clock) => Effect.provideService(effect, Clock.Clock, clock));
}
