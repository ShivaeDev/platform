import { BigDecimal, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class TestResult extends Model.Class<TestResult>("GroupedTestResult")({
	durationMs: Schema.Int,
	failed: Schema.NullOr(Schema.Boolean),
	file: Schema.String,
	id: Schema.Int,
	project: Schema.String,
	weight: Schema.NullOr(Schema.BigDecimalFromString),
}) {}

export const groupedResults = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_grouped_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (
			id integer primary key, file text not null, project text not null,
			"durationMs" integer not null, failed boolean, weight numeric
		)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const results = yield* makeRepository(TestResult, { idColumn: "id", spanPrefix: "TestResult", tableName });
	return { results, tableName };
});

export const resultRows = [
	{ durationMs: 2, failed: true, file: "a.test.ts", id: 1, project: "web", weight: BigDecimal.fromStringUnsafe("9007199254740993.125") },
	{ durationMs: 3, failed: false, file: "a.test.ts", id: 2, project: "web", weight: null },
	{ durationMs: 20, failed: true, file: "a.test.ts", id: 3, project: "api", weight: BigDecimal.fromStringUnsafe("0.125") },
	{ durationMs: 9, failed: false, file: "b.test.ts", id: 4, project: "web", weight: BigDecimal.fromStringUnsafe("0.25") },
	{ durationMs: 1, failed: null, file: "c.test.ts", id: 5, project: "api", weight: null },
];
