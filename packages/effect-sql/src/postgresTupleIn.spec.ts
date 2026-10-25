import { expect } from "vitest";
import { columns, SourceRow } from "#test/insertSelect.ts";
import { PartialRow } from "#test/partialConflicts.ts";
import { input, Payment } from "#test/postgresCodecs.ts";
import { hasInsertSelectRows, hasPartialConflicts } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";
import { tupleIn } from "#tupleIn.ts";

postgres.it("tuple membership compares integer columns with encoded numeric fields", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source } = insertSelect();
	expect(
		yield* source.findMany({
			select: ["sourceKey"],
			where: tupleIn(
				SourceRow,
				["sourceKey", "amount"],
				[
					[1, 10],
					[2, 40],
				],
			),
		}),
	).toEqual([{ sourceKey: 1 }]);
});

postgres.it("tuple membership encodes UTC timestamps, bigints and precise decimals", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const first = yield* payments.insert(input);
	yield* payments.insert({ ...input, sequence: input.sequence + 1n });
	yield* payments.insert({ ...input, "settled_at": new Date("2026-10-25T00:00:00Z") });
	expect(
		yield* payments.findMany({
			select: ["id"],
			where: tupleIn(Payment, ["settled_at", "sequence", "amount"], [[new Date("2026-09-19T00:11:12.345-10:00"), input.sequence, input.amount]]),
		}),
	).toEqual([{ id: first.id }]);
});

postgres.it(
	"findMany matches complete tuples through each field codec alongside other filters",
	[hasPartialConflicts()],
	function* ({ partialConflicts }) {
		const { rows } = partialConflicts();
		yield* rows.insertMany([
			{ a: "one", b: 1, kind: "X", value: 10 },
			{ a: "one", b: 2, kind: "X", value: 10 },
			{ a: "two", b: 1, kind: "X", value: 10 },
			{ a: "two", b: 2, kind: "X", value: 10 },
			{ a: "two", b: 2, kind: "Y", value: 10 },
			{ a: "three", b: 3, kind: "X", value: 20 },
		]);
		expect(
			yield* rows.findMany({
				orderBy: { direction: "asc", field: "a" },
				select: ["a", "b", "kind"],
				where: {
					...tupleIn(
						PartialRow,
						["a", "b", "kind"],
						[
							["one", 1, "X"],
							["two", 2, "X"],
							["three", 3, "X"],
						],
					),
					value: { in: [10] },
				},
			}),
		).toEqual([
			{ a: "one", b: 1, kind: "X" },
			{ a: "two", b: 2, kind: "X" },
		]);
	},
);

postgres.it("select applies tuple membership inside insert-from-select", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source, target } = insertSelect();
	const copied = yield* target.insertFromSelect(
		source.select({
			select: ["sourceKey", "displayName", "amount"],
			where: {
				...tupleIn(
					SourceRow,
					["amount", "displayName"],
					[
						[20, "second"],
						[40, "first"],
					],
				),
				status: "flaky",
			},
		}),
		columns,
	);
	expect(copied.map(({ amount, copiedKey, name }) => ({ amount, copiedKey, name }))).toEqual([{ amount: 20, copiedKey: 2, name: "second" }]);
});

postgres.it(
	"delete removes only complete matching tuples and announces their keys",
	[hasPartialConflicts()],
	function* ({ partialConflicts, watchChanges }) {
		const { rows, options } = partialConflicts();
		const inserted = yield* rows.insertMany([
			{ a: "one", b: 1, kind: "X", value: 10 },
			{ a: "one", b: 2, kind: "X", value: 10 },
			{ a: "two", b: 1, kind: "X", value: 10 },
			{ a: "two", b: 2, kind: "X", value: 20 },
		]);
		const delivered = yield* watchChanges([options.tableName, ...inserted.map(({ id }) => `${options.tableName}:${id}`)]);
		yield* rows.delete({
			...tupleIn(
				PartialRow,
				["a", "b"],
				[
					["one", 1],
					["two", 2],
				],
			),
			value: 10,
		});
		expect(yield* rows.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["a", "b"] })).toEqual([
			{ a: "one", b: 2 },
			{ a: "two", b: 1 },
			{ a: "two", b: 2 },
		]);
		expect(delivered).toEqual([options.tableName, `${options.tableName}:${inserted[0]?.id}`]);
	},
);
