import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { durationsAreNumeric, queries, queryTables, testResults } from "#test/queries.ts";

const invalidQueries = [
	{ name: "an unknown group field", query: { "aggregates": { "tests": { "count": "*" } }, "groupBy": ["missing"] } },
	{ name: "an unknown counted field", query: { "aggregates": { "tests": { "count": "missing" } }, "groupBy": ["file"] } },
	{ name: "an unknown summed field", query: { "aggregates": { "tests": { "sum": "missing" } }, "groupBy": ["file"] } },
	{ name: "an aggregate named like a group field", query: { "aggregates": { "file": { "count": "*" } }, "groupBy": ["file"] } },
	{
		name: "ordering by a field that is neither grouped nor aggregated",
		query: { "aggregates": { "tests": { "count": "*" } }, "groupBy": ["file"], "orderBy": [{ "direction": "asc", "field": "durationMs" }] },
	},
	{ name: "an unknown filter field", query: { "aggregates": { "tests": { "count": "*" } }, "groupBy": ["file"], "where": { "missing": 1 } } },
	{ name: "a negative limit", query: { "aggregates": { "tests": { "count": "*" } }, "groupBy": ["file"], "limit": -1 } },
	{ name: "a fractional limit", query: { "aggregates": { "tests": { "count": "*" } }, "groupBy": ["file"], "limit": 1.5 } },
];

for (const { query, name } of invalidQueries) {
	queries.it(
		`aggregate rejects ${name} with a schema error before sending SQL`,
		[],
		function* ({ aggregateUnknownResults, lastResult, statementsSent }) {
			const input: unknown = query;

			yield* aggregateUnknownResults(input);

			yield* outcomes([
				["aggregate result", () => lastResult(), "failed with a schema error"],
				["statements sent", () => statementsSent(), 0],
			]);
		},
	);
}

const decodedAggregates = [
	{ name: "a group of the duration", query: { aggregates: { tests: { count: "*" } }, groupBy: ["durationMs"] } },
	{ name: "the smallest duration", query: { aggregates: { shortest: { min: "durationMs" } }, groupBy: ["file"] } },
	{ name: "the largest duration", query: { aggregates: { longest: { max: "durationMs" } }, groupBy: ["file"] } },
] as const;

for (const { name, query } of decodedAggregates) {
	queries.it(
		`aggregate decodes ${name} through the model's integer field and fails with a schema error on a numeric duration`,
		[queryTables("results"), testResults(), durationsAreNumeric()],
		function* ({ aggregateResults }) {
			const groups = yield* aggregateResults(query);

			expect(groups).toBe("failed with a schema error");
		},
	);
}
