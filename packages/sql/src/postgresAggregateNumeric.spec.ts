import { expect } from "vitest";
import { queries, testResults } from "#test/queries.ts";

queries.it(
	"aggregate reads the smallest, largest and average duration of each group as numbers, keeping a fractional average",
	[testResults()],
	function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: { average: { avg: "durationMs" }, longest: { max: "durationMs" }, shortest: { min: "durationMs" } },
			groupBy: ["file", "project"],
			orderBy: [
				{ direction: "asc", field: "file" },
				{ direction: "asc", field: "project" },
			],
		});

		expect(groups).toEqual([
			{ average: 20, file: "a.test.ts", longest: 20, project: "api", shortest: 20 },
			{ average: 2.5, file: "a.test.ts", longest: 3, project: "web", shortest: 2 },
			{ average: 9, file: "b.test.ts", longest: 9, project: "web", shortest: 9 },
			{ average: 1, file: "c.test.ts", longest: 1, project: "api", shortest: 1 },
		]);
	},
);

queries.it("aggregate reads the alphabetically first and last project of each file as text", [testResults()], function* ({ aggregateResults }) {
	const groups = yield* aggregateResults({
		aggregates: { first: { min: "project" }, last: { max: "project" } },
		groupBy: ["file"],
		orderBy: [{ direction: "asc", field: "file" }],
	});

	expect(groups).toEqual([
		{ file: "a.test.ts", first: "api", last: "web" },
		{ file: "b.test.ts", first: "web", last: "web" },
		{ file: "c.test.ts", first: "api", last: "api" },
	]);
});

queries.it(
	"aggregate keeps every digit of decimal sums, averages, minimums and maximums, and reads null for a group of only null weights",
	[testResults()],
	function* ({ aggregateResults }) {
		const groups = yield* aggregateResults({
			aggregates: { average: { avg: "weight" }, heaviest: { max: "weight" }, lightest: { min: "weight" }, total: { sum: "weight" } },
			groupBy: ["file"],
			orderBy: [{ direction: "asc", field: "file" }],
		});

		expect(groups).toEqual([
			{
				average: "decimal 4503599627370496.625",
				file: "a.test.ts",
				heaviest: "decimal 9007199254740993.125",
				lightest: "decimal 0.125",
				total: "decimal 9007199254740993.25",
			},
			{ average: "decimal 0.25", file: "b.test.ts", heaviest: "decimal 0.25", lightest: "decimal 0.25", total: "decimal 0.25" },
			{ average: null, file: "c.test.ts", heaviest: null, lightest: null, total: null },
		]);
	},
);
