import { type Clock, Deferred, Duration, Effect } from "effect";
import { changeSignal } from "#test/changeSignal.ts";

export function retryClock(base: Clock.Clock) {
	let now = base.currentTimeMillisUnsafe();
	const sleeps = new Map<Deferred.Deferred<void>, number>();
	const changed = changeSignal();
	const clock: Clock.Clock = {
		...base,
		currentTimeMillis: Effect.sync(() => now),
		currentTimeMillisUnsafe: () => now,
		sleep: (duration) =>
			Effect.scoped(
				Effect.gen(function* () {
					const wake = yield* Deferred.make<void>();
					yield* Effect.acquireRelease(
						Effect.sync(() => {
							sleeps.set(wake, now + Duration.toMillis(duration));
							changed.notify();
						}),
						() => Effect.sync(() => sleeps.delete(wake)),
					);
					yield* Deferred.await(wake);
				}),
			),
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
