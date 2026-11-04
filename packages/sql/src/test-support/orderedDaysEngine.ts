import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeOrderedChildren } from "#makeOrderedChildren.ts";
import { makeRepository } from "#repository.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

class Day extends Model.Class<Day>("OrderedDay")({
	id: Schema.NumberFromString,
	name: Schema.String,
	plan: Schema.Number,
	position: Schema.Number,
	version: Model.Field({ select: Schema.Number, update: Schema.Number }),
}) {}

export const orderedDaysEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const parentTable = uniqueTable("plans");
	const tableName = uniqueTable("days");
	yield* ownTable(sql, parentTable, sql`id integer primary key`);
	yield* ownTable(
		sql,
		tableName,
		sql`id text primary key, name text not null, plan integer not null references ${sql(parentTable)}(id),
		position integer not null, version integer not null, unique(plan, position) deferrable initially deferred`,
	);
	yield* sql`insert into ${sql(parentTable)} (id) values (1), (2)`;
	const options = { idColumn: "id", spanPrefix: "Day", tableName, versionColumn: "version" } as const;
	return {
		days: yield* makeRepository(Day, options),
		order: yield* makeOrderedChildren(Day, { ...options, parentColumn: "plan", parentIdColumn: "id", parentTable, positionColumn: "position" }),
		parentTable,
		sql,
	};
});

export type OrderedDaysEngine = Effect.Success<ReturnType<typeof orderedDaysEngine>>;
