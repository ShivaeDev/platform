import { expect } from "vitest";
import { queries, queryTables } from "#test/queries.ts";

const twoAsAndTwoBs = [
	{ amount: 1, name: "B", note: null },
	{ amount: 1, name: "A", note: null },
	{ amount: 1, name: "B", note: null },
	{ amount: 1, name: "A", note: null },
];

const listOrders = [
	{
		expected: [{ id: 2 }, { id: 4 }, { id: 1 }, { id: 3 }],
		name: "name, then id breaking ties",
		orderBy: [
			{ direction: "asc", field: "name" },
			{ direction: "asc", field: "id" },
		],
	},
	{
		expected: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
		name: "id first, leaving name nothing to break",
		orderBy: [
			{ direction: "asc", field: "id" },
			{ direction: "asc", field: "name" },
		],
	},
] as const;

for (const { expected, name, orderBy } of listOrders) {
	queries.it(`findMany sorts by the ordering list in list order: ${name}`, [queryTables("lines")], function* ({ findLines, saveLines }) {
		yield* saveLines(twoAsAndTwoBs);

		const sorted = yield* findLines({ orderBy, select: ["id"] });

		expect(sorted).toEqual(expected);
	});
}

queries.it(
	"findMany applies ascending names and descending ids before keeping the first three lines",
	[queryTables("lines")],
	function* ({ findLines, saveLines }) {
		yield* saveLines(twoAsAndTwoBs);

		const firstThree = yield* findLines({
			limit: 3,
			orderBy: [
				{ direction: "asc", field: "name" },
				{ direction: "desc", field: "id" },
			],
			select: ["id"],
		});

		expect(firstThree).toEqual([{ id: 4 }, { id: 2 }, { id: 3 }]);
	},
);

const singleOrders = [
	{ name: "a single ordering object", orderBy: { direction: "desc", field: "id" } },
	{ name: "a one-entry ordering list", orderBy: [{ direction: "desc", field: "id" }] },
] as const;

for (const { name, orderBy } of singleOrders) {
	queries.it(`findMany sorts by ${name}`, [queryTables("lines")], function* ({ findLines, saveLines }) {
		yield* saveLines([
			{ amount: 1, name: "A", note: null },
			{ amount: 1, name: "B", note: null },
		]);

		const sorted = yield* findLines({ orderBy, select: ["id"] });

		expect(sorted).toEqual([{ id: 2 }, { id: 1 }]);
	});
}

const UNKNOWN_FIELD = "missing";

const unknownOrders = [
	{ name: "a single ordering object", orderBy: { direction: "asc", field: UNKNOWN_FIELD } },
	{
		name: "the first entry of an ordering list",
		orderBy: [
			{ direction: "asc", field: UNKNOWN_FIELD },
			{ direction: "desc", field: "id" },
		],
	},
	{
		name: "a later entry of an ordering list",
		orderBy: [
			{ direction: "asc", field: "id" },
			{ direction: "desc", field: UNKNOWN_FIELD },
		],
	},
] as const;

for (const { name, orderBy } of unknownOrders) {
	queries.it(`findMany rejects an unknown runtime field in ${name} with a schema error`, [], function* ({ findUnknownLines }) {
		const sorted = yield* findUnknownLines({ orderBy });

		expect(sorted).toBe("failed with a schema error");
	});
}
