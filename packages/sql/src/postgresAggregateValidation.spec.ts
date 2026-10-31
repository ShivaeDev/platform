import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Aggregate } from "#aggregateQuery.ts";
import { durationsAreNumeric, queries, testResults } from "#test/queries.ts";
import type { TestResult } from "#test/queryModels.ts";

type AggregateQuery = Parameters<Aggregate<typeof TestResult>>[0];

const invalidQueries = [
	{ json: '{"groupBy":["missing"],"aggregates":{"tests":{"count":"*"}}}', name: "an unknown group field" },
	{ json: '{"groupBy":["file"],"aggregates":{"tests":{"count":"missing"}}}', name: "an unknown counted field" },
	{ json: '{"groupBy":["file"],"aggregates":{"tests":{"sum":"missing"}}}', name: "an unknown summed field" },
	{ json: '{"groupBy":["file"],"aggregates":{"file":{"count":"*"}}}', name: "an aggregate named like a group field" },
	{
		json: '{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"orderBy":[{"field":"durationMs","direction":"asc"}]}',
		name: "ordering by a field that is neither grouped nor aggregated",
	},
	{ json: '{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"where":{"missing":1}}', name: "an unknown filter field" },
	{ json: '{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"limit":-1}', name: "a negative limit" },
	{ json: '{"groupBy":["file"],"aggregates":{"tests":{"count":"*"}},"limit":1.5}', name: "a fractional limit" },
];

for (const { json, name } of invalidQueries) {
	queries.it(`aggregate rejects ${name} with a schema error before sending SQL`, [], function* ({ aggregateResults, lastResult, statementsSent }) {
		const query: AggregateQuery = JSON.parse(json);

		yield* aggregateResults(query);

		yield* outcomes({
			"aggregate result": [lastResult(), "failed with a schema error"],
			"statements sent": [statementsSent(), 0],
		});
	});
}

const decodedAggregates = [
	{ name: "a group of the duration", query: { aggregates: { tests: { count: "*" } }, groupBy: ["durationMs"] } },
	{ name: "the smallest duration", query: { aggregates: { shortest: { min: "durationMs" } }, groupBy: ["file"] } },
	{ name: "the largest duration", query: { aggregates: { longest: { max: "durationMs" } }, groupBy: ["file"] } },
] as const;

for (const { name, query } of decodedAggregates) {
	queries.it(
		`aggregate decodes ${name} through the model's integer field and fails with a schema error on a numeric duration`,
		[testResults(), durationsAreNumeric()],
		function* ({ aggregateResults }) {
			const groups = yield* aggregateResults(query);

			expect(groups).toBe("failed with a schema error");
		},
	);
}
