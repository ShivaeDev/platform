import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { invoiceKits, linesExist } from "#test/invoices.ts";

for (const invoices of invoiceKits) {
	invoices.it(
		"an inserted line stores its amount as text and reads it back as a number under its generated id",
		[],
		function* ({ insertLine, line, storedAmounts }) {
			yield* insertLine("Consulting", { amount: 52 });

			yield* outcomes({
				"Consulting as read back": [line("Consulting"), { amount: 52, id: 1, name: "Consulting", note: null }],
				"stored amount text": [storedAmounts(), ["52"]],
			});
		},
	);

	for (const write of ["updateLine", "updateLineVoid"] as const) {
		invoices.it(
			`${write === "updateLine" ? "update" : "updateVoid"} rewrites the stored fields of only the line it names`,
			[linesExist(invoices, { Consulting: { amount: 52 }, Hosting: { amount: 57, note: "annual" } })],
			function* (verbs) {
				const { line } = verbs;
				expect(yield* line("Consulting")).toEqual({ amount: 52, id: 1, name: "Consulting", note: null });

				yield* verbs[write]("Consulting", { amount: 55, name: "Onsite consulting" });

				yield* outcomes({
					"Consulting as read back": [line("Consulting"), { amount: 55, id: 1, name: "Onsite consulting", note: null }],
					"Hosting as read back": [line("Hosting"), { amount: 57, id: 2, name: "Hosting", note: "annual" }],
				});
			},
		);
	}

	invoices.it(
		"deleting a line removes only that line",
		[linesExist(invoices, { Consulting: { amount: 52 }, Hosting: { amount: 57 } })],
		function* ({ deleteLine, lineNames }) {
			yield* deleteLine("Consulting");

			expect(yield* lineNames()).toEqual(["Hosting"]);
		},
	);

	invoices.it(
		"deleting an already deleted line succeeds",
		[linesExist(invoices, { Consulting: { amount: 52 } })],
		function* ({ deleteLine, lineNames }) {
			yield* deleteLine("Consulting");
			expect(yield* lineNames()).toEqual([]);

			yield* deleteLine("Consulting");

			expect(yield* lineNames()).toEqual([]);
		},
	);

	invoices.it(
		"a line inserted inside a transaction is visible inside it and gone after the transaction fails",
		[linesExist(invoices, { Consulting: { amount: 52 } })],
		function* ({ inFailingTransaction, insertLine, lineNames }) {
			yield* inFailingTransaction(function* () {
				yield* insertLine("Rollback", { amount: 1 });
				expect(yield* lineNames()).toEqual(["Consulting", "Rollback"]);
			});

			expect(yield* lineNames()).toEqual(["Consulting"]);
		},
	);

	invoices.it(
		"a field codec that needs a service reads it from the caller's environment when writing, filtering and decoding",
		[],
		function* ({ insertLabel, labelsNamed, storedLabelNames }) {
			yield* insertLabel("Consulting");

			yield* outcomes({
				"labels found by their decoded name": [labelsNamed("Consulting"), [{ name: "Consulting" }]],
				"stored label text": [storedLabelNames(), ["db:Consulting"]],
			});
		},
	);
}
