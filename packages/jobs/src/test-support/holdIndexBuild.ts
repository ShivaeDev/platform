import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { waitingVerbs } from "#test/waitingVerbs.ts";

export const holdIndexBuild = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
	const connection = yield* sql.reserve;
	yield* Effect.acquireRelease(connection.executeRaw("BEGIN ISOLATION LEVEL REPEATABLE READ", []), () =>
		connection.executeRaw("ROLLBACK", []).pipe(Effect.orDie),
	);
	yield* connection.executeRaw("SELECT version FROM jobs_test.version", []);
	const progress = connection
		.executeRaw("SELECT pg_stat_clear_snapshot()", [])
		.pipe(
			Effect.andThen(
				connection.executeUnprepared(
					"SELECT pid FROM pg_stat_progress_create_index WHERE relid = 'jobs_test.job_common'::regclass AND phase = 'waiting for old snapshots'",
					[],
					undefined,
				),
			),
		);
	return {
		cancel: Effect.gen(function* () {
			const builds = yield* waitingVerbs().until(progress, (rows) => rows.length > 0);
			const result = yield* connection.executeUnprepared("SELECT pg_cancel_backend($1) AS cancelled", [builds[0]?.pid], undefined);
			if (result[0]?.cancelled !== true) {
				return yield* Effect.fail(new Error("Could not cancel the concurrent index build"));
			}
		}),
		release: connection.executeRaw("ROLLBACK", []),
	};
});
