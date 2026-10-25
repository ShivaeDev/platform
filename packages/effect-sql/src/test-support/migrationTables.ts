import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export const migrationTables = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const prefix = `migration_${crypto.randomUUID().replaceAll("-", "")}`;
	const names = { audit: `${prefix}_audit`, ledger: `${prefix}_ledger`, orders: `${prefix}_orders` };
	yield* Effect.addFinalizer(() =>
		Effect.forEach(
			[names.audit, names.orders, names.ledger, `${names.ledger}_release`, `${names.ledger}_workers`],
			(name) => sql`drop table if exists ${sql(name)}`,
		).pipe(Effect.orDie),
	);
	return names;
});
