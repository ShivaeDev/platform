import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { deferredSave, duplicateSave, refusedTarget, roleScreen } from "#test/roleScreen.ts";

roleScreen.it("keeps searching for a named target until it appears", [deferredSave], function* ({ click, found, search, startsLookingFor }) {
	yield* startsLookingFor({ name: "Save", role: "button" });
	expect(yield* search()).toBe("still searching");

	yield* click("#twin");

	expect(yield* found()).toBe("found the Save button");
});

for (const [how, target] of [
	["a selector", "#save"],
	["a regular expression name", { name: /^save$/iu, role: "button" }],
] as const) {
	roleScreen.it(`finds a target by ${how}`, [], function* ({ find, saveButton }) {
		expect(yield* find(target)).toBe(saveButton());
	});
}

roleScreen.it("lists the visible candidates when finding a target times out", [], function* ({ find }) {
	expect(yield* attempt(find({ name: "Missing", role: "button" }, { timeout: 40 }))).toBe(refusedTarget('0 matches for button named "Missing"'));
});

roleScreen.it("lists both matches among the candidates when a find is ambiguous", [duplicateSave], function* ({ find }) {
	expect(yield* attempt(find({ name: "Save", role: "button" }, { timeout: 40 }))).toBe(
		refusedTarget('2 matches for button named "Save"', '  - button named "Save"'),
	);
});

roleScreen.it("tells the find it starts", [], function* ({ startsLookingFor, story }) {
	yield* startsLookingFor({ name: "Save", role: "button" });

	expect(story.lines).toEqual(['find button named "Save"']);
});
