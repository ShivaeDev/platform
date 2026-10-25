import { Effect, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";

export const watchBackends = Effect.fn("DeploymentStory.watchBackends")(function* () {
	const sql = yield* SqlClient.SqlClient;
	const sample = sql<{ count: number }>`select count(*)::int as count from pg_stat_activity
		where datname = current_database() and pid <> pg_backend_pid()`;
	const counts: number[] = [];
	const record = sample.pipe(
		Effect.tap((rows) =>
			Effect.sync(() => {
				for (const row of rows) {
					counts.push(row.count);
				}
			}),
		),
	);
	yield* record;
	const observer = yield* record.pipe(Effect.repeat(Schedule.spaced("5 millis")), Effect.forkScoped);
	return {
		counts: () => [...counts],
		stop: Fiber.interrupt(observer).pipe(Effect.andThen(record)),
	};
});
