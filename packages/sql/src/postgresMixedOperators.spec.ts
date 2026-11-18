import { expect } from "vitest";
import { queries, queryTables, testResults } from "#test/queries.ts";

const mixed = [
	{ name: "an in list beside a not-null filter", where: { "note": { "in": ["paid", "late"], "not": null } } },
	{ name: "an in list beside a key that names no operator", where: { "note": { "in": ["paid", "late"], "unless": "late" } } },
	{ name: "an in list beside a range", where: { "note": { "gt": "m", "in": ["paid", "late"] } } },
];

for (const { name, where } of mixed) {
	queries.it(`findMany rejects ${name} with a schema error`, [], function* ({ findUnknownPayments }) {
		const found = yield* findUnknownPayments({ where });

		expect(found).toBe("failed with a schema error");
	});
}

queries.it("a prepared select rejects an in list beside a not-null filter with a schema error", [], function* ({ selectUnknownPayments }) {
	const selected = yield* selectUnknownPayments({ "note": { "in": ["paid"], "not": null } });

	expect(selected).toBe("failed with a schema error");
});

queries.it(
	"aggregate rejects an in list beside a not-null filter with a schema error",
	[queryTables("results"), testResults()],
	function* ({ aggregateUnknownResults }) {
		const aggregated = yield* aggregateUnknownResults({
			aggregates: { tests: { count: "*" } },
			groupBy: ["project"],
			orderBy: [{ direction: "asc", field: "project" }],
			where: { "failed": { "in": [true], "not": null } },
		});

		expect(aggregated).toBe("failed with a schema error");
	},
);

for (const { name, where } of [
	{ name: "a range", where: { "note": { "gt": "m", "in": ["paid", "late"] } } },
	{ name: "a not-null filter", where: { "note": { "in": ["paid", "late"], "not": null } } },
]) {
	queries.it(
		`delete rejects an in list beside ${name} with a schema error and removes no payment`,
		[queryTables("payments")],
		function* ({ deleteUnknownPayments, paymentNotes, savePayments }) {
			yield* savePayments([{ note: "paid" }, { note: "late" }]);

			const deleted = yield* deleteUnknownPayments(where);

			expect(deleted).toBe("failed with a schema error");
			expect(yield* paymentNotes()).toEqual([{ note: "paid" }, { note: "late" }]);
		},
	);
}
