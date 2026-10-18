import { Effect } from "effect";

export function eventually<A, E, R>(read: Effect.Effect<A, E, R>, ready: (value: A) => boolean, milliseconds = 15_000) {
	return Effect.gen(function* () {
		while (true) {
			const value = yield* read;
			if (ready(value)) {
				return value;
			}
			yield* Effect.sleep(50);
		}
	}).pipe(Effect.timeout(milliseconds));
}
