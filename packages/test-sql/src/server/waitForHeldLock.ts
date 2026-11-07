import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { type ObserveOptions, observeUntil } from "#server/observeUntil.ts";

export const waitForHeldLock = Effect.fn("PostgresTest.waitForHeldLock")(function* (
	key: string,
	options?: ObserveOptions & { readonly applicationName?: string },
) {
	const sql = yield* SqlClient.SqlClient;
	const holders = sql`select pg_stat_clear_snapshot()`.pipe(
		Effect.andThen(
			sql`select locks.pid from pg_locks locks join pg_stat_activity activity on activity.pid = locks.pid
		where locks.locktype = 'advisory' and locks.granted and locks.objsubid = 1
		and locks.database = (select oid from pg_database where datname = current_database())
		and ((locks.classid::bigint << 32) | locks.objid::bigint) = hashtextextended(${key}, 0)
		and ${options?.applicationName === undefined ? sql`true` : sql`activity.application_name = ${options.applicationName}`}
		order by locks.pid`.withoutTransform,
		),
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ pid: Schema.Number })))),
	);
	return yield* observeUntil(holders, (rows) => rows.length > 0, `the advisory lock ${JSON.stringify(key)} to be held`, options);
});
