import { Clock, Effect, Option, Random, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { WorkerReleaseClock } from "#WorkerReleaseClock.ts";

export const releaseWorkers = Effect.fn("EffectSql.releaseWorkers")(function* (
	release: string,
	staleMillis: number,
	table = "effect_sql_migrations",
) {
	const sql = yield* SqlClient.SqlClient;
	const processId = `${yield* Random.nextInt}:${yield* Random.nextInt}`;
	const workers = `${table}_workers`;
	const testing = yield* Effect.serviceOption(WorkerReleaseClock);
	const now = Option.isSome(testing)
		? Clock.currentTimeMillis.pipe(
				Effect.provideService(Clock.Clock, testing.value.clock),
				Effect.map((millis) => sql`${new Date(millis).toISOString()}::timestamptz`),
			)
		: Effect.succeed(sql`clock_timestamp()`);
	return {
		claim: sql.withTransaction(
			Effect.gen(function* () {
				const timestamp = yield* now;
				const [owner] = yield* sql`select release from ${sql(`${table}_release`)} where id = true for update`.withoutTransform.pipe(
					Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ release: Schema.String })))),
				);
				if (owner?.release !== release) {
					return false;
				}
				const others = yield* sql`select process_id from ${sql(workers)} where release <> ${release}
				and heartbeat > ${timestamp} - ${staleMillis} * interval '1 millisecond'`;
				if (others.length > 0) {
					return false;
				}
				yield* sql`insert into ${sql(workers)} (process_id, release, heartbeat) values (${processId}, ${release}, ${timestamp})
				on conflict (process_id) do update set heartbeat = excluded.heartbeat`;
				return true;
			}),
		),
		heartbeat: now.pipe(
			Effect.flatMap((timestamp) => sql`update ${sql(workers)} set heartbeat = ${timestamp} where process_id = ${processId}`),
			Effect.asVoid,
		),
		remove: sql`delete from ${sql(workers)} where process_id = ${processId}`.pipe(Effect.asVoid),
	};
});
