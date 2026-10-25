import { type Clock, Effect } from "effect";

export function processClock(clock: Clock.Clock, isProcess: (id: number) => boolean) {
	let waiting = false;
	const observed: Clock.Clock = {
		currentTimeMillis: clock.currentTimeMillis,
		currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
		currentTimeNanos: clock.currentTimeNanos,
		currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
		monotonicTimeNanos: clock.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
		sleep: (duration) =>
			Effect.withFiber((fiber) => {
				if (!isProcess(fiber.id)) {
					return clock.sleep(duration);
				}
				waiting = true;
				return clock.sleep(duration).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							waiting = false;
						}),
					),
				);
			}),
	};
	return { clock: observed, waiting: () => waiting };
}
