import { Clock, Duration, Effect, Result } from "effect";
import * as TestClock from "effect/testing/TestClock";

export interface EventuallyOptions {
	readonly interval?: Duration.Input;
	readonly timeout?: Duration.Input;
	readonly times?: number;
	readonly wait?: Effect.Effect<void>;
}

export const eventually = Effect.fnUntraced(function* <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: EventuallyOptions,
): Effect.fn.Return<A, E, R> {
	const clock = yield* Clock.Clock;
	const started = yield* Clock.currentTimeMillis;
	const timeout = options?.timeout === undefined ? undefined : Duration.toMillis(Duration.fromInputUnsafe(options.timeout));
	const interval = options?.interval ?? "10 millis";
	const wait = options?.wait ?? ("adjust" in clock ? TestClock.adjust(interval) : Effect.sleep(interval));
	let retriesLeft = options?.times;
	for (;;) {
		const result = yield* Effect.result(effect);
		if (Result.isSuccess(result)) {
			return result.success;
		}
		const elapsed = (yield* Clock.currentTimeMillis) - started;
		if (retriesLeft === 0 || (timeout !== undefined && elapsed >= timeout)) {
			return yield* Effect.fail(result.failure);
		}
		if (retriesLeft !== undefined) {
			retriesLeft -= 1;
		}
		yield* wait;
	}
});
