import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, queryTables } from "#test/queries.ts";

const notes = [{ note: "paid" }, { note: null }];

const unconstrained = [
	{ name: "an empty filter", where: {} },
	{ name: "a filter whose only entry is undefined", where: { note: undefined } },
	{ name: "a filter whose entries are all undefined", where: { note: undefined, sequence: undefined } },
];

for (const { name, where } of unconstrained) {
	queries.it(
		`delete rejects ${name} with a schema error and removes no payment`,
		[queryTables("payments")],
		function* ({ deleteUnknownPayments, lastResult, paymentNotes, savePayments }) {
			yield* savePayments(notes);

			yield* deleteUnknownPayments(where);

			yield* outcomes([
				["delete result", () => lastResult(), "failed with a schema error"],
				["payment notes", () => paymentNotes(), notes],
			]);
		},
	);

	queries.it(
		`deleteBatched rejects ${name} with a schema error and removes no payment`,
		[queryTables("payments")],
		function* ({ lastResult, paymentNotes, purgeUnknownPayments, savePayments }) {
			yield* savePayments(notes);

			yield* purgeUnknownPayments(where);

			yield* outcomes([
				["purge result", () => lastResult(), "failed with a schema error"],
				["payment notes", () => paymentNotes(), notes],
			]);
		},
	);
}

queries.it("delete with allRows removes every payment", [queryTables("payments")], function* ({ deleteEveryPayment, paymentNotes, savePayments }) {
	yield* savePayments(notes);

	yield* deleteEveryPayment();

	expect(yield* paymentNotes()).toEqual([]);
});
