import { Deferred, Effect } from "effect";

export function changeSignal() {
	let changed = Deferred.makeUnsafe<void>();
	return {
		notify() {
			const previous = changed;
			changed = Deferred.makeUnsafe<void>();
			Deferred.doneUnsafe(previous, Effect.void);
		},
		wait<A, E, R>(read: Effect.Effect<A, E, R>, ready: (value: A) => boolean): Effect.Effect<A, E, R> {
			function wait(): Effect.Effect<A, E, R> {
				return Effect.suspend(() => {
					const next = changed;
					return Effect.flatMap(read, (value) => (ready(value) ? Effect.succeed(value) : Deferred.await(next).pipe(Effect.andThen(wait))));
				});
			}
			return wait();
		},
	};
}
