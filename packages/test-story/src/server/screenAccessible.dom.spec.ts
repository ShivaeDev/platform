import { expect } from "vitest";
import { refusalOf } from "#test/attempt.ts";
import { labelledControl, screenApp } from "#test/screenApp.ts";

screenApp.it("reads the computed label instead of a conflicting aria-label", [labelledControl], ({ accessible }) => {
	expect(accessible("#delivery")).toEqual({ name: "Email notifications", role: "switch" });
});

screenApp.it("tells the accessibility it read for a selector", [labelledControl], ({ accessible, story }) => {
	accessible("#delivery");

	expect(story.lines.at(-1)).toBe('read the accessibility of #delivery: {"name":"Email notifications","role":"switch"}');
});

screenApp.it("reads an implicit role and name from native button content", [], ({ accessible }) => {
	expect(accessible("#load")).toEqual({ name: "Load news", role: "button" });
});

for (const [target, selector, refusal] of [
	["a missing", "#missing", 'threw: The screen has 0 matches for "#missing".'],
	["an ambiguous", "button", 'threw: The screen has 4 matches for "button".'],
] as const) {
	screenApp.it(`refuses to read the accessibility of ${target} target`, [], function* ({ accessible }) {
		expect(yield* refusalOf(() => accessible(selector))).toBe(refusal);
	});
}
