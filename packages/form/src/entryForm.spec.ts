import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { expenses, initial } from "#test/expense.ts";

const savedWithEditsAfterward = [
	expenses.edited("quantity", "2"),
	expenses.saveInFlight(),
	expenses.edited("quantity", "3.50"),
	expenses.edited("date", "2026-09-18"),
	expenses.saveAnswered(),
];
const serverRow = { ...initial, payee: "Server payee", quantity: "2" };

expenses.it(
	"a refresh after a save takes the server's payee and keeps the quantity and date typed during the save",
	savedWithEditsAfterward,
	function* ({ refresh, shown, shownDate }) {
		expect(yield* shown("payee")).toBe(initial.payee);

		yield* refresh(serverRow);

		yield* outcomes({
			date: [shownDate(), "2026-09-18"],
			payee: [shown("payee"), "Server payee"],
			quantity: [shown("quantity"), "3.50"],
		});
	},
);

expenses.it(
	"reverting after that refresh restores the server's payee and quantity, removes the typed date and leaves nothing unsaved",
	[...savedWithEditsAfterward, expenses.refreshReceived(serverRow)],
	function* ({ entryHasDate, revert, shown, shownDate, unsavedChanges }) {
		expect(yield* shownDate()).toBe("2026-09-18");

		yield* revert();

		yield* outcomes({
			date: [shownDate(), undefined],
			"entry has a date": [entryHasDate(), false],
			payee: [shown("payee"), "Server payee"],
			quantity: [shown("quantity"), "2"],
			"unsaved changes": [unsavedChanges(), false],
		});
	},
);

expenses.it(
	"a refresh during an unrelated edit saves the refreshed subtotal with the edited payee",
	[
		expenses.startsWith({ ...initial, subtotal: "300" }),
		expenses.edited("payee", "Harbor Hotel"),
		expenses.refreshReceived({ ...initial, subtotal: "350" }),
	],
	function* ({ savedValue, submit }) {
		yield* submit();

		expect(yield* savedValue()).toMatchObject({ payee: "Harbor Hotel", subtotal: 350 });
	},
);
