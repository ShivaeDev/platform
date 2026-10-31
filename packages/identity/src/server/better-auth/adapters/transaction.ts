import { Data, Deferred, Effect, Fiber, Scope } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";

class Rollback extends Data.TaggedError("BetterAuthRollback") {}

export const betterAuthTransaction = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const context = yield* Effect.context<never>();
	const run = Effect.runPromiseWith(context);
	const scope = yield* Scope.Scope;
	let active: { readonly done: Deferred.Deferred<void, Rollback>; readonly fiber: Fiber.Fiber<void, SqlError> } | undefined;
	return (text: string): Promise<void> | undefined => {
		if (text === "begin") {
			return run(
				Effect.gen(function* () {
					const ready = yield* Deferred.make<void>();
					const done = yield* Deferred.make<void, Rollback>();
					const fiber = yield* sql.withTransaction(Deferred.succeed(ready, undefined).pipe(Effect.andThen(Deferred.await(done)))).pipe(
						Effect.catchTag("BetterAuthRollback", () => Effect.void),
						Effect.forkIn(scope),
					);
					active = { done, fiber };
					yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(fiber));
				}),
			);
		}
		if (active !== undefined && (text === "commit" || text === "rollback")) {
			const { done, fiber } = active;
			active = undefined;
			return run(
				(text === "commit" ? Deferred.succeed(done, undefined) : Deferred.fail(done, new Rollback())).pipe(Effect.andThen(Fiber.join(fiber))),
			);
		}
		return undefined;
	};
});
