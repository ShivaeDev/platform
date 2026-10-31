import { Effect, Stream, SubscriptionRef } from "effect";
import { until } from "@shivaedev/test-story/server/until.ts";

export const listen = Effect.fnUntraced(function* <A, E, R>(stream: Stream.Stream<A, E, R>, ready: (updates: readonly A[]) => boolean) {
	const updates = yield* SubscriptionRef.make<readonly A[]>([]);
	const finished = yield* stream.pipe(
		Stream.runForEach((update) => SubscriptionRef.update(updates, (all) => [...all, update])),
		Effect.forkScoped,
	);
	yield* until(SubscriptionRef.changes(updates), ready, { name: "subscription ready" });
	return { finished, updates };
});
