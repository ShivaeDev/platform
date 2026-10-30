import { type Clock, Deferred, Duration, Effect, Exit, type Fiber } from "effect";
import type { program } from "#program.ts";

export function makeWatchProcess(clock: Clock.Clock) {
	let changed = Deferred.makeUnsafe<void>();
	const state: {
		fiber?: Fiber.Fiber<void, Effect.Error<ReturnType<typeof program>>>;
		finished: boolean;
		processId?: number;
		timers: Set<number>;
		wakeAt: number | undefined;
	} = { finished: false, timers: new Set(), wakeAt: undefined };
	function notify() {
		Deferred.doneUnsafe(changed, Exit.void);
		changed = Deferred.makeUnsafe<void>();
	}
	function untilChange(holds: () => boolean) {
		return Effect.gen(function* () {
			while (!holds()) {
				yield* Deferred.await(changed);
			}
		});
	}
	function tracked(duration: Duration.Duration, record: (wakeAt: number | undefined) => void) {
		return Effect.suspend(() => {
			record(clock.currentTimeMillisUnsafe() + Duration.toMillis(duration));
			notify();
			return clock.sleep(duration);
		}).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					record(undefined);
					notify();
				}),
			),
		);
	}
	const observed: Clock.Clock = {
		currentTimeMillis: clock.currentTimeMillis,
		currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
		currentTimeNanos: clock.currentTimeNanos,
		currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
		monotonicTimeNanos: clock.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
		sleep: (duration) =>
			Effect.withFiber((fiber) => {
				if (fiber.id === state.processId) {
					return tracked(duration, (wakeAt) => {
						state.wakeAt = wakeAt;
					});
				}
				let timer: number | undefined;
				return tracked(duration, (wakeAt) => {
					if (timer !== undefined) {
						state.timers.delete(timer);
					}
					timer = wakeAt;
					if (wakeAt !== undefined) {
						state.timers.add(wakeAt);
					}
				});
			}),
	};
	return {
		changed: notify,
		clock: observed,
		finished: () => {
			state.finished = true;
			notify();
		},
		identify: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.withFiber((fiber) => {
				state.processId = fiber.id;
				return effect;
			}),
		settledUnless: (blocked: () => boolean) =>
			untilChange(
				() =>
					state.fiber === undefined || state.finished || blocked() || (state.wakeAt !== undefined && state.wakeAt > clock.currentTimeMillisUnsafe()),
			),
		state,
		timerStarted: untilChange(() => state.timers.size > 0).pipe(Effect.map(() => Math.min(...state.timers))),
		until: untilChange,
	};
}

export type WatchProcess = ReturnType<typeof makeWatchProcess>;
