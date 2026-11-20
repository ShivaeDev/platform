import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, queryTables, testResults } from "#test/queries.ts";

const notes = [{ note: "paid" }, { note: null }, { note: "" }, { note: "late", sequence: 1n }];

queries.it(
	"a not-null filter reads the payments holding a note, the empty note among them, and leaves out the payment without one",
	[queryTables("payments")],
	function* ({ findPayments, savePayments }) {
		yield* savePayments(notes);

		const found = yield* findPayments({ orderBy: { direction: "asc", field: "id" }, select: ["note"], where: { note: { not: null } } });

		expect(found).toEqual([{ note: "paid" }, { note: "" }, { note: "late" }]);
	},
);

queries.it(
	"a not-null filter combines with equality on another field and reads the one noted payment of that sequence",
	[queryTables("payments")],
	function* ({ findPayments, savePayments }) {
		yield* savePayments([...notes, { note: null, sequence: 1n }]);

		const found = yield* findPayments({ select: ["note"], where: { note: { not: null }, sequence: 1n } });

		expect(found).toEqual([{ note: "late" }]);
	},
);

queries.it("count with a not-null filter counts the payments holding a note", [queryTables("payments")], function* ({ countPayments, savePayments }) {
	const noted = [{ note: "paid" }, { note: "" }, { note: "late" }];
	yield* savePayments([...noted, { note: null }]);

	const count = yield* countPayments({ where: { note: { not: null } } });

	expect(count).toBe(noted.length);
});

queries.it(
	"aggregate with a not-null filter counts and sums only the test results holding a weight",
	[queryTables("results"), testResults()],
	function* ({ aggregateResults }) {
		const weighed = yield* aggregateResults({
			aggregates: { tests: { count: "*" }, total: { sum: "durationMs" } },
			groupBy: ["project"],
			orderBy: [{ direction: "asc", field: "project" }],
			where: { weight: { not: null } },
		});

		expect(weighed).toEqual([
			{ project: "api", tests: 1, total: 20 },
			{ project: "web", tests: 2, total: 11 },
		]);
	},
);

queries.it(
	"a prepared select with a not-null filter reads the payments holding a note",
	[queryTables("payments")],
	function* ({ savePayments, selectPayments }) {
		yield* savePayments(notes);

		const selected = yield* selectPayments({ orderBy: { direction: "asc", field: "id" }, select: ["note"], where: { note: { not: null } } });

		expect(selected).toEqual([{ note: "paid" }, { note: "" }, { note: "late" }]);
	},
);

const invalid = [
	{ name: "a not-null filter on a field that cannot be null", where: { "due_on": { "not": null } } },
	{ name: "a not filter given a value", where: { "note": { "not": "paid" } } },
	{ name: "a not-null filter beside a pattern", where: { "note": { "like": "p%", "not": null } } },
];

for (const { where, name } of invalid) {
	queries.it(`findMany rejects ${name} with a schema error`, [], function* ({ findUnknownPayments }) {
		const found = yield* findUnknownPayments({ where });

		expect(found).toBe("failed with a schema error");
	});
}

queries.it(
	"delete with a not-null filter removes the payments holding a note and keeps the payment without one",
	[queryTables("payments")],
	function* ({ deletePayments, paymentNotes, savePayments }) {
		yield* savePayments(notes);

		yield* deletePayments({ note: { not: null } });

		expect(yield* paymentNotes()).toEqual([{ note: null }]);
	},
);

queries.it(
	"deleteBatched with a not-null filter removes the three payments holding a note and keeps the payment without one",
	[queryTables("payments")],
	function* ({ lastResult, paymentNotes, purgePayments, savePayments }) {
		yield* savePayments(notes);

		yield* purgePayments({ note: { not: null } });

		yield* outcomes([
			["removed payments", () => lastResult(), 3],
			["payment notes", () => paymentNotes(), [{ note: null }]],
		]);
	},
);

queries.it(
	"latestPerGroup with a not-null filter beside pinned names reads the highest-amount noted line of each name, skipping lines without a note",
	[queryTables("lines")],
	function* ({ latestLines, saveLines }) {
		yield* saveLines([
			{ amount: 1, name: "A", note: "x" },
			{ amount: 2, name: "A", note: "y" },
			{ amount: 3, name: "A", note: null },
			{ amount: 1, name: "B", note: "x" },
			{ amount: 2, name: "B", note: null },
		]);

		const latest = yield* latestLines({
			limit: 1,
			orderBy: [{ direction: "desc", field: "amount" }],
			partitionBy: ["name"],
			where: { name: { in: ["A", "B"] }, note: { not: null } },
		});

		expect(latest).toEqual([
			{ amount: 2, id: 2, name: "A", note: "y" },
			{ amount: 1, id: 4, name: "B", note: "x" },
		]);
	},
);

queries.it(
	"latestPerGroup partitioned by note with a not-null filter on it reads the highest-amount line of each note and no group for lines without one",
	[queryTables("lines")],
	function* ({ latestLines, saveLines }) {
		yield* saveLines([
			{ amount: 1, name: "A", note: "build" },
			{ amount: 2, name: "A", note: "build" },
			{ amount: 1, name: "A", note: "deploy" },
			{ amount: 5, name: "A", note: null },
		]);

		const latest = yield* latestLines({
			limit: 1,
			orderBy: [{ direction: "desc", field: "amount" }],
			partitionBy: ["note"],
			where: { note: { not: null } },
		});

		expect(latest).toEqual([
			{ amount: 2, id: 2, name: "A", note: "build" },
			{ amount: 1, id: 3, name: "A", note: "deploy" },
		]);
	},
);
