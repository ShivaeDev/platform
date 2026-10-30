import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, sourceRows } from "#test/queries.ts";
import { PartialRow, Payment, payment, SourceRow } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

queries.it(
	"a tuple matches a source only when its integer key and its text-stored amount match together",
	[sourceRows()],
	function* ({ findSources }) {
		const found = yield* findSources({
			select: ["sourceKey"],
			where: tupleIn(
				SourceRow,
				["sourceKey", "amount"],
				[
					[1, 10],
					[2, 40],
				],
			),
		});

		expect(found).toEqual([{ sourceKey: 1 }]);
	},
);

queries.it(
	"a tuple encodes an offset Date, a bigint and a decimal through their field codecs to match the payment",
	[],
	function* ({ findPayments, savePayments }) {
		yield* savePayments([
			{ note: "matching" },
			{ note: "next sequence", sequence: payment.sequence + 1n },
			{ note: "later", "settled_at": new Date("2026-10-25T00:00:00Z") },
		]);

		const found = yield* findPayments({
			select: ["note"],
			where: tupleIn(Payment, ["settled_at", "sequence", "amount"], [[new Date("2026-09-19T00:11:12.345-10:00"), payment.sequence, payment.amount]]),
		});

		expect(found).toEqual([{ note: "matching" }]);
	},
);

const partialRows = [
	{ a: "one", b: 1, kind: "X", value: 10 },
	{ a: "one", b: 2, kind: "X", value: 10 },
	{ a: "two", b: 1, kind: "X", value: 10 },
	{ a: "two", b: 2, kind: "X", value: 10 },
	{ a: "two", b: 2, kind: "Y", value: 10 },
	{ a: "three", b: 3, kind: "X", value: 20 },
];

queries.it(
	"findMany reads only rows matching a whole tuple, encoding each tuple value through its field codec, and the in list beside it",
	[],
	function* ({ findPartialRows, savePartialRows }) {
		yield* savePartialRows(partialRows);

		const found = yield* findPartialRows({
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
		});

		expect(found).toEqual([
			{ a: "one", b: 1, kind: "X" },
			{ a: "two", b: 2, kind: "X" },
		]);
	},
);

queries.it("select applies a tuple filter beside equality when copying sources", [sourceRows()], function* ({ copySelected }) {
	const copied = yield* copySelected({
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
	});

	expect(copied).toEqual([expect.objectContaining({ amount: 20, copiedKey: 2, name: "second" })]);
});

queries.it(
	"delete removes only rows matching a whole tuple and the equality beside it, and announces the removed row's key",
	[],
	function* ({ announced, deletePartialRows, partialRows: storedRows, savePartialRows, watch }) {
		yield* savePartialRows([
			{ a: "one", b: 1, kind: "X", value: 10 },
			{ a: "one", b: 2, kind: "X", value: 10 },
			{ a: "two", b: 1, kind: "X", value: 10 },
			{ a: "two", b: 2, kind: "X", value: 20 },
		]);
		yield* watch("partialRows", "partialRows:1", "partialRows:2", "partialRows:3", "partialRows:4");

		yield* deletePartialRows({
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

		yield* outcomes({
			"announced keys": [announced(), ["partialRows", "partialRows:1"]],
			"stored rows": [
				storedRows(),
				[
					{ a: "one", b: 2 },
					{ a: "two", b: 1 },
					{ a: "two", b: 2 },
				],
			],
		});
	},
);
