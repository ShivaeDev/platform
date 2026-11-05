import { Effect, Queue } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { querySignals } from "@shivaedev/contract/querySignals.ts";

export interface SettledQueries<A, E> {
	readonly latest: Effect.Effect<AsyncResult.AsyncResult<A, E>>;
	readonly next: Effect.Effect<AsyncResult.AsyncResult<A, E>>;
}

export const settledQueries = Effect.fn("Contract.settledQueries")(function* <A, E>(query: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	const registry = yield* AtomRegistry.AtomRegistry;
	const results = yield* Queue.unbounded<AsyncResult.AsyncResult<A, E>>();
	let completed = 0;
	yield* Effect.acquireRelease(
		Effect.sync(() => registry.mount(query)),
		(stop) => Effect.sync(stop),
	);
	yield* Effect.acquireRelease(
		Effect.sync(() =>
			registry.subscribe(
				querySignals(query),
				(state) => {
					if (!state.pending && state.completed > completed) {
						completed = state.completed;
						Queue.offerUnsafe(results, registry.get(query));
					}
				},
				{ immediate: true },
			),
		),
		(stop) => Effect.sync(stop),
	);
	return {
		latest: Effect.sync(() => registry.get(query)),
		next: Queue.take(results),
	} satisfies SettledQueries<A, E>;
});
