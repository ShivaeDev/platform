import { type Clock, Effect } from "effect";

export function offsetClock(clock: Clock.Clock, millis: number): Clock.Clock {
	const nanos = BigInt(millis) * 1_000_000n;
	return {
		currentTimeMillis: Effect.map(clock.currentTimeMillis, (now) => now + millis),
		currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe() + millis,
		currentTimeNanos: Effect.map(clock.currentTimeNanos, (now) => now + nanos),
		currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe() + nanos,
		monotonicTimeNanos: clock.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
		sleep: (duration) => clock.sleep(duration),
	};
}
