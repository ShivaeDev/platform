import { Deferred, Effect, Exit } from "effect";

export function roundSignals() {
	let completed = Deferred.makeUnsafe<void, unknown>();
	return {
		observeRound: <A, E, R>(round: Effect.Effect<A, E, R>) =>
			Effect.suspend(() => {
				completed = Deferred.makeUnsafe<void, unknown>();
				const completion = completed;
				return round.pipe(Effect.onExit((exit) => Deferred.done(completion, Exit.asVoid(exit))));
			}),
		roundCompleted: Effect.suspend(() => Deferred.await(completed)),
	};
}
