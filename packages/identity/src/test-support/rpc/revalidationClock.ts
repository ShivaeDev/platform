import { type Duration, Effect, Queue } from "effect";
import { TestClock } from "effect/testing";

export function revalidationClock(interval: () => Duration.Input, checked: Queue.Queue<void>, tell: (line: string) => void) {
	return {
		revalidationIntervalPasses: () => {
			const duration = interval();
			tell(`${duration} pass and the session is checked again`);
			return Queue.clear(checked).pipe(Effect.andThen(TestClock.adjust(duration)), Effect.andThen(Queue.take(checked)));
		},
	};
}
