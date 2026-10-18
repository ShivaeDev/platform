import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
export function slowCommit(sql: SqlClient.SqlClient, table: string, seconds: number) {
	const name = table.replace("_orders_", "_slow_");
	return Effect.acquireRelease(
		Effect.andThen(
			sql.unsafe(`create function "${name}"() returns trigger language plpgsql as $$ begin perform pg_sleep(${seconds}); return null; end $$`),
			sql.unsafe(
				`create constraint trigger "${name}" after insert on "${table}" deferrable initially deferred for each row execute function "${name}"()`,
			),
		),
		() => Effect.orDie(sql.unsafe(`drop function "${name}"() cascade`)),
	);
}
export function isCommitting(observer: SqlClient.SqlClient, pid: number) {
	return observer<{
		readonly state: string | null;
		readonly query: string;
	}>`select state, query from pg_stat_activity where pid = ${pid}`.pipe(
		Effect.map((rows) => rows.some((row) => row.state === "active" && row.query === "COMMIT")),
	);
}
