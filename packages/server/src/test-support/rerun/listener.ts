import { Effect, Stream, SubscriptionRef } from "effect";

export function until<A>(stream: Stream.Stream<A>, matches: (value: A) => boolean) {
	return stream.pipe(Stream.filter(matches), Stream.runHead, Effect.orDie);
}

export const listen = Effect.fnUntraced(function* <A, E, R>(stream: Stream.Stream<A, E, R>, ready: (updates: readonly A[]) => boolean) {
	const updates = yield* SubscriptionRef.make<readonly A[]>([]);
	const finished = yield* stream.pipe(
		Stream.runForEach((update) => SubscriptionRef.update(updates, (all) => [...all, update])),
		Effect.forkScoped,
	);
	yield* until(SubscriptionRef.changes(updates), ready);
	return { finished, updates };
});
