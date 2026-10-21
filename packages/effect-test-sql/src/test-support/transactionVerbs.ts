import { Deferred, Effect, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
export function transactionVerbs(engine: DatabaseEngine) {
	return {
		inRollback: <A, E, R>(effect: Effect.Effect<A, E, R>) => engine.run(withTestTransaction(effect)),
		inSavepoint: <A, E, R>(effect: Effect.Effect<A, E, R>) => transact(effect, { onSqlError: (error) => error }),
		interruptWrite: () =>
			engine.run(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const entered = yield* Deferred.make<void>();
					const fiber = yield* withTestTransaction(
						Effect.gen(function* () {
							yield* sql`update items set value = 'interrupted'`;
							yield* Deferred.succeed(entered, undefined);
							yield* Effect.never;
						}),
					).pipe(Effect.forkScoped);
					yield* Deferred.await(entered);
					yield* Fiber.interrupt(fiber);
					return yield* Fiber.await(fiber);
				}),
			),
		invalidateItems: () => invalidateOnCommit(["items"]),
		readNotes: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select id, value from notes`),
		writeNote: (value: string) => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`insert into notes values (1, ${value})`),
	};
}
