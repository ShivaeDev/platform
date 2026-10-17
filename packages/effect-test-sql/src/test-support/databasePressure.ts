import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";

function holdConnections(poolSize: number, entered: Effect.Effect<void>, release: Deferred.Deferred<void>) {
	return withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			let acquired = 0;
			const reserved = Effect.gen(function* () {
				acquired += 1;
				if (acquired <= poolSize) {
					yield* entered;
				}
				yield* Deferred.await(release);
			});
			return yield* Effect.forEach(Array.from({ length: 6 }), () => Effect.scoped(Effect.andThen(sql.reserve, reserved)), {
				concurrency: "unbounded",
			});
		}),
	);
}

export const databasePressure = Effect.fn("ConnectionBudget.databasePressure")(function* (count: number, poolSize: number) {
	const ready = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let acquired = 0;
	const entered = Effect.gen(function* () {
		acquired += 1;
		if (acquired === count * poolSize) {
			yield* Deferred.succeed(ready, undefined);
		}
	});
	const clones = yield* Effect.forEach(Array.from({ length: count }), () => holdConnections(poolSize, entered, release), {
		concurrency: "unbounded",
	}).pipe(Effect.forkScoped);
	return { clones, ready: Deferred.await(ready), release: Deferred.succeed(release, undefined) };
});
