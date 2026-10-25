import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class LatestRun extends Model.Class<LatestRun>("LatestRun")({
	id: Schema.Int,
	repository: Schema.NumberFromString.check(Schema.isInt()),
	status: Schema.String,
	workflow: Schema.NullOr(Schema.String),
}) {}

export const latestRuns = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_runs_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer primary key, repository numeric not null, workflow text, status text not null)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	yield* sql`create index on ${sql(tableName)} (repository, id desc)`;
	yield* sql`create index on ${sql(tableName)} (repository, workflow, id desc)`;
	yield* sql`insert into ${sql(tableName)} select id, (id - 1) / 9000 + 1,
		case (id - 1) / 3000 % 3 when 0 then 'build' when 1 then 'deploy' else null end,
		case id % 2 when 0 then 'completed' else 'queued' end from generate_series(1, 27000) as id`;
	yield* sql`analyze ${sql(tableName)}`;
	const runs = yield* makeRepository(LatestRun, { idColumn: "id", spanPrefix: "LatestRun", tableName });
	return { runs, tableName };
});
