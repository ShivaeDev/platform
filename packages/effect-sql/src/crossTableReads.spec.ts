import { DateTime, Effect, Option, Schema } from "effect";
import { expect, expectTypeOf } from "vitest";
import { hasDashboardRows } from "#test/cross-table/hasDashboardRows.ts";
import { postgres } from "#test/sqlStory.ts";

const since = DateTime.makeUnsafe("2026-10-25T10:00:00Z");

postgres.it(
	"the dashboard inner join decodes model fields and excludes unreported pull requests",
	[hasDashboardRows()],
	function* ({ crossTableReads }) {
		const rows = yield* crossTableReads().reads.listReports({ since });
		expectTypeOf(rows).toEqualTypeOf<
			Array<{
				readonly pullRequestId: number;
				readonly reportId: number;
				readonly score: number;
				readonly title: string;
				readonly updatedAt: DateTime.Utc;
			}>
		>();
		expect(rows.map((row) => ({ ...row, updatedAt: DateTime.formatIso(row.updatedAt) }))).toEqual([
			{ pullRequestId: 1, reportId: 10, score: 7, title: "First", updatedAt: "2026-10-25T10:00:00.000Z" },
			{ pullRequestId: 3, reportId: 30, score: 9, title: "Latest", updatedAt: "2026-10-25T12:00:00.000Z" },
		]);
	},
);

postgres.it("the dashboard left join decodes unmatched report columns as null", [hasDashboardRows()], function* ({ crossTableReads }) {
	const rows = yield* crossTableReads().reads.listPullRequests({ since });
	expectTypeOf(rows[0]?.score).toEqualTypeOf<number | null | undefined>();
	expectTypeOf(rows[0]?.reportId).toEqualTypeOf<number | null | undefined>();
	expect(rows.map((row) => ({ ...row, updatedAt: DateTime.formatIso(row.updatedAt) }))).toEqual([
		{ pullRequestId: 1, reportId: 10, score: 7, title: "First", updatedAt: "2026-10-25T10:00:00.000Z" },
		{ pullRequestId: 2, reportId: null, score: null, title: "Unreported", updatedAt: "2026-10-25T11:00:00.000Z" },
		{ pullRequestId: 3, reportId: 30, score: 9, title: "Latest", updatedAt: "2026-10-25T12:00:00.000Z" },
	]);
});

postgres.it(
	"the dashboard encodes a UTC filter through its model codec into a bound Date",
	[hasDashboardRows()],
	function* ({ crossTableReads, captureStatement }) {
		const bound = DateTime.makeUnsafe("2026-10-25T13:00:00+02:00");
		const { rows, statements } = yield* captureStatement(crossTableReads().reads.listReports({ since: bound }));
		expect(rows.map((row) => row.pullRequestId)).toEqual([3]);
		const oneQuery = 1;
		expect(statements).toHaveLength(oneQuery);
		expect(statements[0]?.[0]).toContain("where p.updated_at >= $1");
		expect(statements[0]?.[1]).toEqual([new Date("2026-10-25T11:00:00Z")]);
	},
);

postgres.it(
	"a stored report that violates the composed result schema fails in the typed channel",
	[hasDashboardRows()],
	function* ({ crossTableReads, sql }) {
		const { reads, tables } = crossTableReads();
		yield* sql`update ${sql(tables.reports)} set score = 'invalid' where id = 30`;
		const failure = yield* reads.listReports({ since }).pipe(Effect.flip);
		expect(Schema.isSchemaError(failure)).toBe(true);
		expect(failure.message).toContain("score");
	},
);

postgres.it("the dashboard single-row join returns a decoded report or None", [hasDashboardRows()], function* ({ crossTableReads }) {
	const { reads } = crossTableReads();
	const row = yield* reads.findReport(3);
	expect(Option.map(row, ({ score, updatedAt }) => ({ score, updatedAt: DateTime.formatIso(updatedAt) }))).toEqual(
		Option.some({ score: 9, updatedAt: "2026-10-25T12:00:00.000Z" }),
	);
	expect(yield* reads.findReport(2)).toEqual(Option.none());
});
