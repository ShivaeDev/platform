import { expect } from "vitest";
import { resultRows, TestResult } from "#test/groupedResults.ts";
import { hasGroupedResults } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { tupleIn } from "#tupleIn.ts";

postgres.it("aggregate sums duration and counts rows by one or two text columns", [hasGroupedResults()], function* ({ groupedResults }) {
	const { results } = groupedResults();
	yield* results.insertMany(resultRows);
	const aggregates = { tests: { count: "*" }, total: { sum: "durationMs" } } as const;
	expect(yield* results.aggregate({ aggregates, groupBy: ["file"], orderBy: [{ direction: "asc", field: "file" }] })).toEqual([
		{ file: "a.test.ts", tests: 3, total: 25 },
		{ file: "b.test.ts", tests: 1, total: 9 },
		{ file: "c.test.ts", tests: 1, total: 1 },
	]);
	expect(
		yield* results.aggregate({
			aggregates,
			groupBy: ["file", "project"],
			orderBy: [
				{ direction: "asc", field: "file" },
				{ direction: "asc", field: "project" },
			],
		}),
	).toEqual([
		{ file: "a.test.ts", project: "api", tests: 1, total: 20 },
		{ file: "a.test.ts", project: "web", tests: 2, total: 5 },
		{ file: "b.test.ts", project: "web", tests: 1, total: 9 },
		{ file: "c.test.ts", project: "api", tests: 1, total: 1 },
	]);
});

postgres.it("aggregate distinguishes nullable counts and combines boolean values per group", [hasGroupedResults()], function* ({ groupedResults }) {
	const { results } = groupedResults();
	yield* results.insertMany(resultRows);
	expect(
		yield* results.aggregate({
			aggregates: {
				allFailed: { boolAnd: "failed" },
				anyFailed: { boolOr: "failed" },
				tests: { count: "*" },
				weighted: { count: "weight" },
			},
			groupBy: ["file"],
			orderBy: [{ direction: "asc", field: "file" }],
		}),
	).toEqual([
		{ allFailed: false, anyFailed: true, file: "a.test.ts", tests: 3, weighted: 2 },
		{ allFailed: false, anyFailed: false, file: "b.test.ts", tests: 1, weighted: 1 },
		{ allFailed: null, anyFailed: null, file: "c.test.ts", tests: 1, weighted: 0 },
	]);
});

postgres.it("aggregate orders slowest groups numerically before limiting them", [hasGroupedResults()], function* ({ groupedResults }) {
	const { results } = groupedResults();
	yield* results.insertMany(resultRows);
	const query = { aggregates: { total: { sum: "durationMs" } }, groupBy: ["file"], orderBy: [{ direction: "desc", field: "total" }] } as const;
	expect(yield* results.aggregate({ ...query, limit: 2 })).toEqual([
		{ file: "a.test.ts", total: 25 },
		{ file: "b.test.ts", total: 9 },
	]);
	expect(yield* results.aggregate({ ...query, limit: 0 })).toEqual([]);
});

postgres.it(
	"aggregate applies equality, in, comparisons, like and tupleIn before grouping",
	[hasGroupedResults()],
	function* ({ groupedResults, captureStatement }) {
		const { results } = groupedResults();
		yield* results.insertMany(resultRows);
		const filtered = yield* captureStatement(
			results.aggregate({
				aggregates: { tests: { count: "*" }, total: { sum: "durationMs" } },
				groupBy: ["file"],
				where: {
					...tupleIn(
						TestResult,
						["file", "project"],
						[
							["a.test.ts", "web"],
							["b.test.ts", "web"],
						],
					),
					durationMs: { gt: 2, lte: 9 },
					file: { like: "a%" },
					id: { in: [1, 2, 3, 4] },
					project: "web",
				},
			}),
		);
		expect(filtered.rows).toEqual([{ file: "a.test.ts", tests: 1, total: 3 }]);
		const statementsPerReport = 1;
		expect(filtered.statements).toHaveLength(statementsPerReport);
		expect(filtered.statements[0]?.[1]).toEqual(expect.arrayContaining(["web", "a%", 2, 9]));
		expect(filtered.statements[0]?.[0]).not.toContain("a%");
	},
);

postgres.it("aggregate returns no rows for an empty table", [hasGroupedResults()], function* ({ groupedResults }) {
	const { results } = groupedResults();
	expect(yield* results.aggregate({ aggregates: { tests: { count: "*" }, total: { sum: "durationMs" } }, groupBy: ["file"] })).toEqual([]);
});
