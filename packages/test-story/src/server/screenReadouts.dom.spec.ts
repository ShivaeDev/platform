import { expect } from "vitest";
import { refusalOf } from "#test/attempt.ts";
import { readoutScreen } from "#test/readoutScreen.tsx";

for (const [label, expected] of [
	["Summary", "Two ready"],
	["Destination", "London"],
	["Notes", "Leave at reception"],
] as const) {
	readoutScreen.it(`reads the visible text labelled ${label}`, [], ({ labelledText }) => {
		expect(labelledText(label)).toBe(expected);
	});
}

readoutScreen.it("matches a readout's label by regular expression", [], ({ labelledText }) => {
	expect(labelledText(/destinat/iu)).toBe("London");
});

readoutScreen.it("reads the whole screen without hidden text", [], ({ text }) => {
	const shown = text();
	expect(shown).toContain("Deliveries\nTwo ready\nDestination\nLondon");
	expect(shown).not.toMatch(/secret|Hidden|Internal/u);
});

for (const label of ["Ready deliveries", /ready deliveries/iu]) {
	readoutScreen.it(`reads the table named by ${String(label)} as visible rows of cell text`, [], ({ table }) => {
		expect(table(label)).toEqual([
			["City", "Status"],
			["London", "Ready"],
			["Paris", "In transit"],
		]);
	});
}

for (const [label, count] of [
	["Missing", 0],
	["Hidden summary", 0],
	["Repeated", 2],
] as const) {
	readoutScreen.it(`refuses the ${label} label with ${count} visible matches`, [], function* ({ labelledText }) {
		expect(yield* refusalOf(() => labelledText(label))).toBe(`threw: The screen has ${count} elements labelled ${label}.`);
	});
}
