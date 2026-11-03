import { Effect, Option, Queue, Stream, SubscriptionRef } from "effect";
import type { ScreenSignal } from "#server/screenSignal.ts";

export const settlingSignals = Effect.fn("Story.settlingSignals")(function* (
	pending: SubscriptionRef.SubscriptionRef<boolean>,
	activity: ScreenSignal,
	transport: Stream.Stream<boolean>,
) {
	const transportCurrent = Stream.runHead(transport).pipe(Effect.map(Option.getOrThrow));
	const current = Effect.all({
		"client activity": Effect.map(activity.current, (state) => state.pending),
		"pending work": SubscriptionRef.get(pending),
		transport: transportCurrent,
	});
	const observations = yield* Queue.unbounded<Effect.Success<typeof current>>();
	function record(signal: ScreenSignal): ScreenSignal {
		return Object.assign(
			Stream.map(signal, (state) => state),
			{
				current: signal.current.pipe(Effect.tap(() => current.pipe(Effect.flatMap((state) => Queue.offer(observations, state))))),
			},
		);
	}
	function screenState(busy: boolean) {
		return { hints: 0, pending: busy };
	}
	return {
		activity: record(activity),
		observations,
		pending: record(
			Object.assign(Stream.map(SubscriptionRef.changes(pending), screenState), { current: Effect.map(SubscriptionRef.get(pending), screenState) }),
		),
		transport: record(Object.assign(Stream.map(transport, screenState), { current: Effect.map(transportCurrent, screenState) })),
	};
});
