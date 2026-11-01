import * as Clock from "effect/Clock";
import type * as Effect from "effect/Effect";
import * as TestClock from "effect/testing/TestClock";

export function withLive<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
	return Clock.clockWith((clock) => ("withLive" in clock ? TestClock.withLive(effect) : effect));
}
