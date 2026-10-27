import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
export function limitVerbs(engine: DatabaseEngine) {
	return {
		divideByZero: () => engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select 1 / 0`)),
		exhaustClone: () =>
			engine.run(
				withIsolatedDatabase(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql.reserve;
						const database = yield* PostgresTestDatabase;
						return yield* PgClient.makeClient({ url: database.url });
					}),
				),
			),
		exhaustRollback: () =>
			engine.run(
				Effect.scoped(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql.reserve;
						return yield* withTestTransaction(Effect.void);
					}),
				),
			),
		failInClone: (error: unknown) => engine.run(withIsolatedDatabase(Effect.fail(error))),
		failInRollback: (error: unknown) => engine.run(withTestTransaction(Effect.fail(error))),
	};
}
