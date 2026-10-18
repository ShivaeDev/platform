import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { notesRoute, screens } from "#test-support/screens.ts";

screens.it(
	"lists saved notes in the data table and sorts their linked titles in both directions",
	[notesRoute()],
	function* ({ closeScreen, consoleErrors, enter, submit, noteLink, notesTable, click }) {
		yield* enter("Apple");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("Apple")));
		yield* enter("Zebra");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("Zebra")));
		const table = yield* notesTable();
		expect(table.getAttribute("aria-label")).toBe("Saved notes");
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Zebra", "Apple"]);
		expect(table.querySelector("tbody td a")?.getAttribute("href")).toBe("/notes/2");
		yield* click("Title");
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Apple", "Zebra"]);
		expect(table.querySelector("th")?.getAttribute("aria-sort")).toBe("ascending");
		yield* click("Title");
		expect([...table.querySelectorAll("tbody td a")].map((link) => link.textContent)).toEqual(["Zebra", "Apple"]);
		expect(table.querySelector("th")?.getAttribute("aria-sort")).toBe("descending");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
