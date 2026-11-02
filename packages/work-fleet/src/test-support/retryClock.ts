import { type Clock, Deferred, Duration, Effect } from "effect";
import { changeSignal } from "#test/changeSignal.ts";

export function retryClock(base: Clock.Clock, delayMs: number) {
	let now = base.currentTimeMillisUnsafe();
	const sleeps = new Map<Deferred.Deferred<void>, number>();
	const changed = changeSignal();
	const waitForAdvance = Effect.scoped(
		Effect.gen(function* () {
			const wake = yield* Deferred.make<void>();
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					sleeps.set(wake, now + delayMs);
					changed.notify();
				}),
				() => Effect.sync(() => sleeps.delete(wake)),
			);
			yield* Deferred.await(wake);
		}),
	);
	const clock: Clock.Clock = {
		currentTimeMillis: Effect.sync(() => now),
		currentTimeMillisUnsafe: () => now,
		currentTimeNanos: base.currentTimeNanos,
		currentTimeNanosUnsafe: () => base.currentTimeNanosUnsafe(),
		monotonicTimeNanos: base.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => base.monotonicTimeNanosUnsafe(),
		sleep: (duration) => (Duration.toMillis(duration) === delayMs ? waitForAdvance : base.sleep(duration)),
	};
	function adjust(milliseconds: number) {
		return Effect.sync(() => {
			now += milliseconds;
			for (const [wake, at] of sleeps) {
				if (at <= now) {
					sleeps.delete(wake);
					Deferred.doneUnsafe(wake, Effect.void);
				}
			}
		});
	}
	return {
		adjust,
		awaitSleep: changed
			.wait(
				Effect.sync(() => sleeps.size),
				(count) => count > 0,
			)
			.pipe(Effect.asVoid),
		clock,
		next: changed
			.wait(
				Effect.sync(() => [...sleeps.values()]),
				(pending) => pending.length > 0,
			)
			.pipe(Effect.flatMap((pending) => adjust(Math.max(0, Math.min(...pending) - now)))),
	};
}
