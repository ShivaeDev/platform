import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const migrationTable = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql`select to_regclass('app_migrations') as ledger`;
});
