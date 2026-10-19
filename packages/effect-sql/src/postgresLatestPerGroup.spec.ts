import { Effect, Schema } from "effect";
import * as Statement from "effect/sql/Statement";
import { expect } from "vitest";
import { hasPostgresInvoiceLines } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

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
		const statementsPerRead = 1;
		expect(statements).toHaveLength(statementsPerRead);
	},
);

postgres.it(
	"latestPerGroup uses the declared tie-break direction at the partition boundary",
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
