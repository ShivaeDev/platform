import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { observeUntil } from "#observeUntil.ts";

export type Lock = "row" | "table" | "advisory";

export function takeLock(sql: SqlClient.SqlClient, lock: Lock) {
	switch (lock) {
		case "row":
			return sql`select id from items where id = 1 for update`;
		case "table":
			return sql`lock table items in share mode`;
		case "advisory":
			return sql`select pg_advisory_xact_lock(42)`;
	}
}

function afterWaiting(sql: SqlClient.SqlClient, count: number) {
	const waiting = sql`select pg_stat_clear_snapshot()`.pipe(
		Effect.andThen(sql<{ waiting: number }>`select count(*)::integer as waiting from pg_stat_activity
			where datname = current_database() and wait_event_type = 'Lock'`),
		Effect.map(([row]) => row?.waiting ?? 0),
	);
	return observeUntil(waiting, (sessions) => sessions === count, `${count} sessions waiting on a lock`);
}

export const anotherSessionWaits = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
	const connection = yield* sql.reserve;
	yield* Effect.forkScoped(connection.executeRaw("select pg_advisory_xact_lock(42)", []));
	yield* afterWaiting(sql, 1);
});

export const claim = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, name: string, guarded: boolean, lock: Lock, waitersAhead: number) {
	if (name === "charlie") {
		yield* afterWaiting(sql, waitersAhead + 2);
	}
	if (lock === "advisory") {
		yield* sql`select pg_advisory_xact_lock(42)`;
	}
	if (!guarded) {
		const [row] = yield* sql<{ value: string }>`select value from items where id = 1`;
		if (row?.value !== "seed") {
			return yield* Effect.fail("full" as const);
		}
	}
	const changed = guarded
		? yield* sql`update items set value = ${name} where id = 1 and value = 'seed' returning value`
		: yield* sql`update items set value = ${name} where id = 1 returning value`;
	return changed.length > 0 ? name : yield* Effect.fail("full" as const);
});
