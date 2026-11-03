import { Deferred, Effect, Exit } from "effect";

export function serverSignals() {
	const releases = new Set<() => void>();
	const holds = new Map<string, { readonly arrived: Deferred.Deferred<void>; readonly release: () => void; readonly released: Promise<void> }>();
	let completed = Deferred.makeUnsafe<void, unknown>();
	return {
		arrive: async (path: string) => {
			const hold = holds.get(path);
			if (hold !== undefined) {
				holds.delete(path);
				Deferred.doneUnsafe(hold.arrived, Effect.void);
				await hold.released;
				releases.delete(hold.release);
			}
		},
		holdRequest: (path: string) => {
			const arrived = Deferred.makeUnsafe<void>();
			const { promise, resolve } = Promise.withResolvers<void>();
			holds.set(path, { arrived, release: resolve, released: promise });
			releases.add(resolve);
			return { arrived: Deferred.await(arrived), release: () => resolve() };
		},
		observeRound: <A, E, R>(round: Effect.Effect<A, E, R>) =>
			Effect.suspend(() => {
				completed = Deferred.makeUnsafe<void, unknown>();
				const completion = completed;
				return round.pipe(Effect.onExit((exit) => Deferred.done(completion, Exit.asVoid(exit))));
			}),
		releaseAll: () => {
			for (const release of releases) {
				release();
			}
		},
		roundCompleted: Effect.suspend(() => Deferred.await(completed)),
	};
}
