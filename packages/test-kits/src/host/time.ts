import { type Duration, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { WorkerReleaseClock } from "@shivaedev/sql/WorkerReleaseClock.ts";

export const hostTime = Effect.fn("HostTime.hostTime")(function* () {
	const clock = yield* TestClock.testClockWith(Effect.succeed);
	const ticks = new Set<Parameters<typeof WorkerReleaseClock.Service.register>[0]>();
	return {
		layer: Layer.succeed(WorkerReleaseClock, {
			clock,
			register: (tick) =>
				Effect.acquireRelease(
					Effect.sync(() => {
						ticks.add(tick);
					}),
					() =>
						Effect.sync(() => {
							ticks.delete(tick);
						}),
				).pipe(Effect.asVoid),
		}),
		timePasses: (duration: Duration.Input, options?: { readonly poll?: boolean }) =>
			Effect.gen(function* () {
				yield* clock.adjust(duration);
				for (const tick of ticks) {
					yield* tick.heartbeat;
					if (options?.poll !== false) {
						yield* tick.poll;
					}
				}
			}),
	};
});
