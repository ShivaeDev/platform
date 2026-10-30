import { Effect, Random, Schema } from "effect";
import { SqlClient } from "effect/sql";

export const releaseWorkers = Effect.fn("EffectSql.releaseWorkers")(function* (
	release: string,
	staleMillis: number,
	table = "effect_sql_migrations",
) {
	const sql = yield* SqlClient.SqlClient;
	const processId = `${yield* Random.nextInt}:${yield* Random.nextInt}`;
	const workers = `${table}_workers`;
	return {
		claim: sql.withTransaction(
			Effect.gen(function* () {
				const [owner] = yield* sql`select release from ${sql(`${table}_release`)} where id = true for update`.withoutTransform.pipe(
					Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ release: Schema.String })))),
				);
				if (owner?.release !== release) {
					return false;
				}
				const others = yield* sql`select process_id from ${sql(workers)} where release <> ${release}
				and heartbeat > clock_timestamp() - ${staleMillis} * interval '1 millisecond'`;
				if (others.length > 0) {
					return false;
				}
				yield* sql`insert into ${sql(workers)} (process_id, release, heartbeat) values (${processId}, ${release}, clock_timestamp())
				on conflict (process_id) do update set heartbeat = excluded.heartbeat`;
				return true;
			}),
		),
		heartbeat: sql`update ${sql(workers)} set heartbeat = clock_timestamp() where process_id = ${processId}`.pipe(Effect.asVoid),
		remove: sql`delete from ${sql(workers)} where process_id = ${processId}`.pipe(Effect.asVoid),
	};
});
