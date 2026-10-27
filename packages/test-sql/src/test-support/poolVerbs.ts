import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
export function poolVerbs(engine: DatabaseEngine) {
	const next = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select nextval('test_ids')::int as id`);
	const schema = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select to_regclass('contacts') as name`);
	return {
		nextInClone: () => engine.run(withIsolatedDatabase(next)),
		nextInRollback: () => engine.run(withTestTransaction(next)),
		nextInShared: () => engine.run(next),
		readAcquisition: () => Effect.sync(() => engine.acquired),
		readCloneMigrations: () =>
			engine.run(
				withIsolatedDatabase(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						return { items: yield* sql`select * from items`, ledger: yield* sql`select migration_id from effect_sql_migrations` };
					}),
				),
			),
		readCloneSchema: () => engine.run(withIsolatedDatabase(schema)),
		readSharedSchema: () => engine.run(schema),
		readTemplate: () => Effect.sync(() => engine.template),
	};
}
