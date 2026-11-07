import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { type ObserveOptions, observeUntil } from "#server/observeUntil.ts";

export const waitForBlockedSessions = Effect.fn("PostgresTest.waitForBlockedSessions")(function* (holderPid: number, options?: ObserveOptions) {
	const sql = yield* SqlClient.SqlClient;
	const blocked = sql`select pg_stat_clear_snapshot()`.pipe(
		Effect.andThen(
			sql`select pid from pg_stat_activity
			where datname = current_database() and ${holderPid} = any(pg_blocking_pids(pid))
			order by pid`.withoutTransform,
		),
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ pid: Schema.Number })))),
	);
	return yield* observeUntil(blocked, (rows) => rows.length > 0, `a session to block behind backend ${holderPid}`, options);
});
