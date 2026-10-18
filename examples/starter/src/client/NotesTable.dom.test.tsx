import { expect } from "vitest";
import { notesRoute, screens } from "#test-support/screens.ts";

screens.it(
	"lists saved notes in the data table and sorts their linked titles in both directions",
	[notesRoute()],
	function* ({ enter, submit, noteLinkIs, notesTable, click }) {
		yield* enter("Apple");
		yield* submit();
		yield* noteLinkIs("Apple");
		yield* enter("Zebra");
		yield* submit();
		yield* noteLinkIs("Zebra");
		const table = yield* notesTable();
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Zebra", "Apple"]);
		expect(table.querySelector("tbody td a")?.getAttribute("href")).toBe("/notes/2");
		yield* click("Title");
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Apple", "Zebra"]);
		expect(table.querySelector("th")?.getAttribute("aria-sort")).toBe("ascending");
		yield* click("Title");
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Zebra", "Apple"]);
		expect(table.querySelector("th")?.getAttribute("aria-sort")).toBe("descending");
	},
);
