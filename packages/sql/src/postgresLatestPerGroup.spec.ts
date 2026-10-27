import { Effect, Schema } from "effect";
import * as Statement from "effect/sql/Statement";
import { expect } from "vitest";
import { planNodes } from "#test/explain.ts";
import { latestRunCases } from "#test/latestRunCases.ts";
import { LatestRun } from "#test/latestRuns.ts";
import { hasLatestRuns, hasPostgresInvoiceLines } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { tupleIn } from "#tupleIn.ts";

postgres.it(
	"latestPerGroup reads N rows per composite group across parents in one statement",
	[hasPostgresInvoiceLines()],
	function* ({ invoiceLines }) {
		const { lines } = invoiceLines();
		yield* lines.insertMany([
			{ amount: 1, name: "A", note: "build" },
			{ amount: 2, name: "A", note: "build" },
			{ amount: 3, name: "A", note: "build" },
			{ amount: 1, name: "A", note: "deploy" },
			{ amount: 2, name: "A", note: "deploy" },
			{ amount: 3, name: "A", note: "deploy" },
			{ amount: 1, name: "B", note: "build" },
			{ amount: 2, name: "B", note: "build" },
			{ amount: 3, name: "B", note: "build" },
		]);
		const statements: string[] = [];
		const rows = yield* lines
			.latestPerGroup({
				limit: 2,
				orderBy: [
					{ direction: "desc", field: "amount" },
					{ direction: "desc", field: "id" },
				],
				partitionBy: ["name", "note"],
			})
			.pipe(
				Effect.provideService(Statement.CurrentTransformer, (statement) => {
					statements.push(statement.compile()[0]);
					return Effect.succeed(statement);
				}),
			);
		expect(rows).toEqual([
			{ amount: 3, id: 3, name: "A", note: "build" },
			{ amount: 2, id: 2, name: "A", note: "build" },
			{ amount: 3, id: 6, name: "A", note: "deploy" },
			{ amount: 2, id: 5, name: "A", note: "deploy" },
			{ amount: 3, id: 9, name: "B", note: "build" },
			{ amount: 2, id: 8, name: "B", note: "build" },
		]);
		expect(statements).toEqual([expect.stringContaining("row_number()")]);
	},
);

postgres.it(
	"latestPerGroup uses the declared tie-break direction at a pinned partition boundary",
	[hasPostgresInvoiceLines()],
	function* ({ invoiceLines }) {
		const { lines } = invoiceLines();
		yield* lines.insertMany([
			{ amount: 1, name: "A", note: null },
			{ amount: 1, name: "A", note: null },
			{ amount: 1, name: "A", note: null },
			{ amount: 2, name: "A", note: null },
		]);
		for (const direction of ["asc", "desc"] as const) {
			const rows = yield* lines.latestPerGroup({
				limit: 2,
				orderBy: [
					{ direction: "desc", field: "amount" },
					{ direction, field: "id" },
				],
				partitionBy: ["name"],
				where: { name: "A" },
			});
			expect(rows.map((row) => row.id)).toEqual(direction === "asc" ? [4, 1] : [4, 3]);
		}
	},
);

postgres.it("latestPerGroup keeps short groups and supports a zero limit", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	yield* lines.insertMany([
		{ amount: 1, name: "A", note: null },
		{ amount: 2, name: "A", note: null },
		{ amount: 3, name: "B", note: null },
	]);
	const query = { orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["name"] } as const;
	expect((yield* lines.latestPerGroup({ ...query, limit: 3 })).map((row) => row.id)).toEqual([2, 1, 3]);
	expect(yield* lines.latestPerGroup({ ...query, limit: 0 })).toEqual([]);
	expect(yield* lines.latestPerGroup({ ...query, limit: -1 }).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
});

postgres.it("latestPerGroup encodes typed filters before ranking the matching rows", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	yield* lines.insertMany([
		{ amount: 1, name: "A", note: null },
		{ amount: 1, name: "B", note: null },
		{ amount: 1, name: "C", note: null },
		{ amount: 2, name: "A", note: null },
		{ amount: 1, name: "A", note: "hidden" },
		{ amount: 1, name: "B", note: "hidden" },
	]);
	expect(
		yield* lines.latestPerGroup({
			limit: 1,
			orderBy: [{ direction: "desc", field: "id" }],
			partitionBy: ["name"],
			where: { amount: 1, name: { in: ["A", "B"] }, note: null },
		}),
	).toEqual([
		{ amount: 1, id: 1, name: "A", note: null },
		{ amount: 1, id: 2, name: "B", note: null },
	]);
});

for (const { name, partitionBy, where, matches, groups } of latestRunCases) {
	postgres.it(`latestPerGroup stops at each indexed group for ${name}`, [hasLatestRuns()], function* ({ latestRuns, captureStatement, explain }) {
		const { runs, tableName, rowCount } = latestRuns();
		const query = { limit: 20, orderBy: [{ direction: "desc", field: "id" }], partitionBy } as const;
		const ranked = yield* captureStatement(runs.latestPerGroup(query));
		const pinned = yield* captureStatement(runs.latestPerGroup({ ...query, where }));
		expect(pinned.rows).toEqual(ranked.rows.filter(matches));
		expect(pinned.rows).toHaveLength(20 * groups);
		expect(pinned.statements).toEqual([[expect.stringContaining("cross join lateral"), expect.any(Array)]]);
		const statement = pinned.statements[0];
		const ranking = ranked.statements[0];
		if (statement === undefined || ranking === undefined) {
			throw new Error("Expected captured reads");
		}
		const pinnedPlan = (yield* explain(statement))[0]?.["QUERY PLAN"][0]?.Plan;
		const rankedPlan = (yield* explain(ranking))[0]?.["QUERY PLAN"][0]?.Plan;
		if (pinnedPlan === undefined || rankedPlan === undefined) {
			throw new Error("Expected execution plans");
		}
		const scans = planNodes(pinnedPlan).filter((node) => node["Relation Name"] === tableName && node["Actual Loops"] > 0);
		expect(scans.length).toBeGreaterThan(0);
		expect(scans.every((node) => node["Node Type"] === "Index Scan" && node["Actual Rows"] <= query.limit)).toBe(true);
		expect(scans.reduce((total, node) => total + node["Actual Rows"] * node["Actual Loops"], 0)).toBeLessThanOrEqual(query.limit * groups);
		expect(planNodes(pinnedPlan).some((node) => node["Node Type"] === "WindowAgg")).toBe(false);
		expect(planNodes(rankedPlan).some((node) => node["Node Type"] === "WindowAgg")).toBe(true);
		expect(
			planNodes(rankedPlan)
				.filter((node) => node["Relation Name"] === tableName)
				.reduce((total, node) => total + node["Actual Rows"], 0),
		).toBe(rowCount);
	});
}

postgres.it(
	"latestPerGroup returns empty pins without executing SQL and preserves typed failures",
	[hasLatestRuns()],
	function* ({ latestRuns, captureStatement }) {
		const { runs } = latestRuns();
		const query = { limit: 20, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["repository"] } as const;
		for (const where of [{ repository: { in: [] } }, { repository: 1, status: { in: [] } }, tupleIn(LatestRun, ["repository", "workflow"], [])]) {
			const empty = yield* captureStatement(runs.latestPerGroup({ ...query, where }));
			expect(empty).toEqual({ rows: [], statements: [] });
		}
		expect(yield* runs.latestPerGroup({ ...query, where: { repository: Number.NaN } }).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
		expect(yield* runs.latestPerGroup({ ...query, limit: -1, where: { repository: 1 } }).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
	},
);

postgres.it(
	"latestPerGroup keeps ranking partially pinned partitions and filters before limiting pinned groups",
	[hasLatestRuns()],
	function* ({ latestRuns, captureStatement }) {
		const { runs } = latestRuns();
		const query = { limit: 3, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["repository", "workflow"] } as const;
		const partial = yield* captureStatement(runs.latestPerGroup({ ...query, where: { repository: 1, status: "completed" } }));
		const pinned = yield* captureStatement(runs.latestPerGroup({ ...query, where: { repository: 1, status: "completed", workflow: null } }));
		expect(pinned.statements[0]?.[0]).toContain("cross join lateral");
		expect(pinned.rows).toEqual(partial.rows.filter((row) => row.workflow === null));
		expect(pinned.rows.map((row) => row.id)).toEqual([9000, 8998, 8996]);
		expect(partial.statements[0]?.[0]).toContain("row_number()");
	},
);
