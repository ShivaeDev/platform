import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, testResults } from "#test/queries.ts";
import { TestResult } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

const testsAndTotal = { tests: { count: "*" }, total: { sum: "durationMs" } } as const;

const groupings = [
	{
		expected: [
			{ file: "a.test.ts", tests: 3, total: 25 },
			{ file: "b.test.ts", tests: 1, total: 9 },
			{ file: "c.test.ts", tests: 1, total: 1 },
		],
		groupBy: ["file"],
		name: "file",
	},
	{
		expected: [
			{ file: "a.test.ts", project: "api", tests: 1, total: 20 },
			{ file: "a.test.ts", project: "web", tests: 2, total: 5 },
			{ file: "b.test.ts", project: "web", tests: 1, total: 9 },
			{ file: "c.test.ts", project: "api", tests: 1, total: 1 },
		],
		groupBy: ["file", "project"],
		name: "file and project",
	},
] as const;

for (const { expected, groupBy, name } of groupings) {
	queries.it(`aggregate counts the results and sums their durations per ${name}`, [testResults()], function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: testsAndTotal,
			groupBy,
			orderBy: groupBy.map((field) => ({ direction: "asc", field })),
		});

		expect(groups).toEqual(expected);
	});
}

queries.it(
	"aggregate counts every row for count of * but only the non-null values for count of a field",
	[testResults()],
	function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: { tests: { count: "*" }, weighted: { count: "weight" } },
			groupBy: ["file"],
			orderBy: [{ direction: "asc", field: "file" }],
		});

		expect(groups).toEqual([
			{ file: "a.test.ts", tests: 3, weighted: 2 },
			{ file: "b.test.ts", tests: 1, weighted: 1 },
			{ file: "c.test.ts", tests: 1, weighted: 0 },
		]);
	},
);

queries.it(
	"boolOr and boolAnd combine a group's outcomes, and a group with only null outcomes combines to null",
	[testResults()],
	function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: { allFailed: { boolAnd: "failed" }, anyFailed: { boolOr: "failed" } },
			groupBy: ["file"],
			orderBy: [{ direction: "asc", field: "file" }],
		});

		expect(groups).toEqual([
			{ allFailed: false, anyFailed: true, file: "a.test.ts" },
			{ allFailed: false, anyFailed: false, file: "b.test.ts" },
			{ allFailed: null, anyFailed: null, file: "c.test.ts" },
		]);
	},
);

queries.it("aggregate orders the groups by their summed duration before keeping the two slowest", [testResults()], function* ({ aggregateResults }) {
	const slowest = yield* aggregateResults({
		aggregates: { total: { sum: "durationMs" } },
		groupBy: ["file"],
		limit: 2,
		orderBy: [{ direction: "desc", field: "total" }],
	});

	expect(slowest).toEqual([
		{ file: "a.test.ts", total: 25 },
		{ file: "b.test.ts", total: 9 },
	]);
});

queries.it("aggregate with a zero limit returns no groups", [testResults()], function* ({ aggregateResults }) {
	const groups = yield* aggregateResults({ aggregates: testsAndTotal, groupBy: ["file"], limit: 0 });

	expect(groups).toEqual([]);
});

queries.it(
	"aggregate applies equality, in, comparison, like and tupleIn filters to the results before grouping them",
	[testResults()],
	function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: testsAndTotal,
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
		});

		expect(groups).toEqual([{ file: "a.test.ts", tests: 1, total: 3 }]);
	},
);

queries.it(
	"aggregate sends its filter values as bound parameters, not as SQL text",
	[testResults()],
	function* ({ aggregateResults, boundParameters, sqlTextContains }) {
		yield* aggregateResults({ aggregates: testsAndTotal, groupBy: ["file"], where: { durationMs: { lte: 9 }, file: { like: "a%" } } });

		yield* outcomes({
			"bound parameters": [boundParameters(), [expect.arrayContaining(["a%", 9])]],
			"pattern written into the SQL": [sqlTextContains("a%"), false],
		});
	},
);
