import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";

export function migrationLoader(table: string, initialOnly = false) {
	const initial = SqlClient.SqlClient.use((sql) => sql`create table ${sql(table)} (id integer primary key)`);
	return Migrator.fromRecord(
		initialOnly
			? { "001_initial": initial }
			: {
					"001_initial": initial,
					"002_ready": Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql`alter table ${sql(table)} add column ready boolean not null default true`;
					}),
				},
	);
}
