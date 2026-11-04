import { expect } from "vitest";
import { linesExist, postgresInvoices, storedAmountIsText } from "#test/invoices.ts";

const storedLines = linesExist(postgresInvoices, {
	Consulting: { amount: 52 },
	Hosting: { amount: 57, note: "annual" },
	Travel: { amount: 52, note: "flight" },
});

const cases = [
	{
		claim: "findOne returns Some with only the selected decoded fields matching both filters",
		expected: { some: { amount: 52, name: "Consulting" } },
		query: { select: ["name", "amount"], where: { amount: 52, note: null } },
	},
	{
		claim: "findOne returns None when no row matches",
		expected: "none",
		query: { where: { name: "Missing" } },
	},
	{
		claim: "findOne returns only the first matching row in the requested order",
		expected: { some: { name: "Travel" } },
		query: { orderBy: { direction: "desc", field: "name" }, select: ["name"], where: { amount: 52 } },
	},
] as const;

for (const { claim, expected, query } of cases) {
	postgresInvoices.it(claim, [storedLines], function* ({ findLine }) {
		const found = yield* findLine(query);

		expect(found).toEqual(expected);
	});
}

postgresInvoices.it(
	"findOne preserves a stored value's schema error instead of reporting None",
	[storedAmountIsText(postgresInvoices, "not-a-number")],
	function* ({ findLine }) {
		const found = yield* findLine({ where: { name: "Imported" } });

		expect(found).toBe("failed with a schema error");
	},
);
