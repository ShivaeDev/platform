import { Effect, Queue } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

export const queryUpdates = Effect.fn("AppStory.queryUpdates")(function* <A, E>(
	registry: AtomRegistry.AtomRegistry,
	query: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
	const updates = yield* Queue.unbounded<A>();
	let previous: AsyncResult.Success<A, E> | undefined;
	yield* Effect.acquireRelease(
		Effect.sync(() =>
			registry.subscribe(
				query,
				(result) => {
					if (AsyncResult.isSuccess(result) && !result.waiting && result !== previous) {
						previous = result;
						Queue.offerUnsafe(updates, result.value);
					}
				},
				{ immediate: true },
			),
		),
		(stop) => Effect.sync(stop),
	);
	return {
		current: () => AsyncResult.getOrElse(registry.get(query), () => undefined),
		next: () => Queue.take(updates),
	};
});
