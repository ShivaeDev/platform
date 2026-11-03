import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { inValues } from "#inValues.ts";
import { makeRepository } from "#repository.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

class Run extends Model.Class<Run>("PurgeRun")({ id: Schema.Int, owner: bucket(Schema.String) }) {}
class Child extends Model.Class<Child>("PurgeChild")({ id: Schema.Int, owner: bucket(Schema.String), runId: bucket(Schema.Int) }) {}

export const groupRows = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("group_runs");
	const childTable = uniqueTable("group_children");
	yield* ownTable(sql, tableName, sql`id integer primary key, owner text not null`);
	yield* ownTable(sql, childTable, sql`id integer primary key, owner text not null, "runId" integer not null references ${sql(tableName)}(id)`);
	const keys = collection(tableName, Schema.Int, { owner: Schema.String });
	const childKeys = collection(childTable, Schema.Int, { owner: Schema.String, runId: Schema.Int });
	const runs = yield* makeRepository(Run, { collection: keys, idColumn: "id", spanPrefix: "Run", tableName });
	const children = yield* makeRepository(Child, { collection: childKeys, idColumn: "id", spanPrefix: "Child", tableName: childTable });
	function stored() {
		return sql<{
			readonly id: number;
			readonly children: number;
		}>`select r.id, (select count(*)::int from ${sql(childTable)} c where c."runId" = r.id) as children
			from ${sql(tableName)} r order by r.id`;
	}
	const select = Effect.fnUntraced(function* (limit: number) {
		const locked = yield* sql<{
			readonly id: number;
		}>`select id from ${sql(tableName)} where owner = 'alice' order by id limit ${limit} for update skip locked`;
		const predicate = yield* inValues(
			sql`r.id`,
			locked.map(({ id }) => id),
		);
		return yield* sql<{ readonly value: number; readonly rowCount: number }>`select r.id as value,
			(1 + (select count(*) from ${sql(childTable)} c where c."runId" = r.id))::int as "rowCount"
			from ${sql(tableName)} r where ${predicate} order by r.id`;
	});
	const remove = Effect.fnUntraced(function* (id: number) {
		yield* children.delete({ runId: id });
		yield* runs.delete(id);
	});
	return { childKeys, children, childTable, keys, remove, runs, select, sql, stored, tableName };
});

export type GroupRows = Effect.Success<ReturnType<typeof groupRows>>;
