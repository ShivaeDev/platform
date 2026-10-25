import { BigDecimal } from "effect";
import { expect } from "vitest";
import { resultRows } from "#test/groupedResults.ts";
import { hasGroupedResults } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it("aggregate min, max and fractional avg agree with native PostgreSQL", [hasGroupedResults()], function* ({ groupedResults, sql }) {
	const { results, tableName } = groupedResults();
	yield* results.insertMany(resultRows);
	const rows = yield* results.aggregate({
		aggregates: {
			average: { avg: "durationMs" },
			first: { min: "project" },
			last: { max: "project" },
			maximum: { max: "durationMs" },
			minimum: { min: "durationMs" },
		},
		groupBy: ["file", "project"],
		orderBy: [
			{ direction: "asc", field: "file" },
			{ direction: "asc", field: "project" },
		],
	});
	const native = yield* sql`select file, project, min("durationMs") as minimum, max("durationMs") as maximum,
		cast(avg("durationMs") as text) as average, min(project) as first, max(project) as last
		from ${sql(tableName)} group by file, project order by file, project`;
	expect(rows).toEqual(native.map((row) => ({ ...row, average: Number(row.average) })));
	const averageWebDuration = 2.5;
	expect(rows.find((row) => row.project === "web" && row.file === "a.test.ts")?.average).toBe(averageWebDuration);
});

postgres.it(
	"aggregate preserves precise decimal sums and averages and nulls for all-null groups",
	[hasGroupedResults()],
	function* ({ groupedResults, sql }) {
		const { results, tableName } = groupedResults();
		yield* results.insertMany(resultRows);
		const rows = yield* results.aggregate({
			aggregates: {
				average: { avg: "weight" },
				maximum: { max: "weight" },
				minimum: { min: "weight" },
				total: { sum: "weight" },
			},
			groupBy: ["file"],
			orderBy: [{ direction: "asc", field: "file" }],
		});
		const native = yield* sql`select file, cast(sum(weight) as text) as total, cast(avg(weight) as text) as average,
		min(weight) as minimum, max(weight) as maximum from ${sql(tableName)} group by file order by file`;
		expect(rows).toEqual(
			native.map((row) =>
				Object.fromEntries(
					Object.entries(row).map(([key, value]) => [key, key === "file" || value === null ? value : BigDecimal.fromStringUnsafe(String(value))]),
				),
			),
		);
		expect(rows[0]?.total && BigDecimal.equals(rows[0].total, BigDecimal.fromStringUnsafe("9007199254740993.25"))).toBe(true);
		expect(rows[2]).toEqual({ average: null, file: "c.test.ts", maximum: null, minimum: null, total: null });
	},
);
