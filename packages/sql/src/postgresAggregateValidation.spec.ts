import { Effect, Schema } from "effect";
import { expect } from "vitest";
import type { Aggregate } from "#aggregateQuery.ts";
import { resultRows, type TestResult } from "#test/groupedResults.ts";
import { hasGroupedResults } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"aggregate rejects unknown names and invalid limits before executing SQL",
	[hasGroupedResults()],
	function* ({ groupedResults, captureStatement }) {
		const { results } = groupedResults();
		const invalid = [
			'{"groupBy":["missing"],"aggregates":{"tests":{"count":"*"}}}',
			'{"groupBy":["file"],"aggregates":{"tests":{"count":"missing"}}}',
			'{"groupBy":["file"],"aggregates":{"tests":{"sum":"missing"}}}',
			'{"groupBy":["file"],"aggregates":{"file":{"count":"*"}}}',
			'{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"orderBy":[{"field":"durationMs","direction":"asc"}]}',
			'{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"where":{"missing":1}}',
			'{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"limit":-1}',
			'{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"limit":1.5}',
		];
		for (const json of invalid) {
			const query: Parameters<Aggregate<typeof TestResult>>[0] = JSON.parse(json);
			const captured = yield* captureStatement(results.aggregate(query).pipe(Effect.flip));
			expect(captured.rows).toBeInstanceOf(Schema.SchemaError);
			expect(captured.statements).toEqual([]);
		}
	},
);

postgres.it("aggregate decodes group columns and min/max through their model schemas", [hasGroupedResults()], function* ({ groupedResults, sql }) {
	const { results, tableName } = groupedResults();
	yield* results.insertMany(resultRows);
	yield* sql`alter table ${sql(tableName)} alter column "durationMs" type numeric`;
	yield* sql`update ${sql(tableName)} set "durationMs" = 1.5 where id = 1`;
	expect(yield* results.aggregate({ aggregates: { tests: { count: "*" } }, groupBy: ["durationMs"] }).pipe(Effect.flip)).toBeInstanceOf(
		Schema.SchemaError,
	);
	expect(yield* results.aggregate({ aggregates: { smallest: { min: "durationMs" } }, groupBy: ["file"] }).pipe(Effect.flip)).toBeInstanceOf(
		Schema.SchemaError,
	);
	expect(yield* results.aggregate({ aggregates: { largest: { max: "durationMs" } }, groupBy: ["file"] }).pipe(Effect.flip)).toBeInstanceOf(
		Schema.SchemaError,
	);
});
