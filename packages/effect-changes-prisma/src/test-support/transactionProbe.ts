import { Clock, type Duration, Effect } from "effect";

export function transactionProbe(duration: Duration.Input) {
	const state = { interrupted: false, sideEffects: 0 };
	return {
		body: <A, E, R>(write: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				yield* write;
				yield* Effect.sleep(duration);
				state.sideEffects += 1;
			}).pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						state.interrupted = true;
					}),
				),
			),
		state,
	};
}

export const timed = Effect.fn("ChangesPrisma.timed")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const started = yield* Clock.currentTimeMillis;
	const result = yield* effect;
	return { elapsed: (yield* Clock.currentTimeMillis) - started, result };
});
