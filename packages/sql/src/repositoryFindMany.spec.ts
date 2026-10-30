import { expect } from "vitest";
import { invoiceKits, linesExist, storedAmountIsText } from "#test/invoices.ts";

const missingField: "name" = JSON.parse('"missing"');
const queries = [
	{
		claim: "an equality and a null filter match only the line with that amount and no note, returning only the selected fields",
		expected: [{ amount: 52, name: "Consulting" }],
		query: { select: ["name", "amount"], where: { amount: 52, note: null } },
	},
	{
		claim: "an undefined filter value leaves its field unconstrained",
		expected: [{ name: "Hosting" }],
		query: { select: ["name"], where: { amount: 57, name: undefined } },
	},
	{
		claim: "a descending order with a limit returns the last name first",
		expected: [{ name: "Travel" }],
		query: { limit: 1, orderBy: { direction: "desc", field: "name" }, select: ["name"] },
	},
	{ claim: "a limit of zero returns no lines", expected: [], query: { limit: 0 } },
	{ claim: "a negative limit fails with a schema error", expected: "failed with a schema error", query: { limit: -1 } },
	{
		claim: "an unknown selected field fails with a schema error",
		expected: "failed with a schema error",
		query: { select: [missingField] },
	},
	{
		claim: "an unknown filter field fails with a schema error",
		expected: "failed with a schema error",
		query: { where: { [missingField]: "Consulting" } },
	},
	{
		claim: "an unknown order field fails with a schema error",
		expected: "failed with a schema error",
		query: { orderBy: { direction: "asc", field: missingField } },
	},
] as const;

for (const invoices of invoiceKits) {
	for (const { claim, expected, query } of queries) {
		invoices.it(
			`findMany with ${claim}`,
			[linesExist(invoices, { Consulting: { amount: 52 }, Hosting: { amount: 57, note: "annual" }, Travel: { amount: 52, note: "flight" } })],
			function* ({ findLines }) {
				const found = yield* findLines(query);

				expect(found).toEqual(expected);
			},
		);
	}

	invoices.it(
		"findMany fails with a schema error when a stored amount is not a number",
		[storedAmountIsText(invoices, "not-a-number")],
		function* ({ findLines }) {
			const found = yield* findLines({});

			expect(found).toBe("failed with a schema error");
		},
	);
}
