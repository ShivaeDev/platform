import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { groupedScreen } from "#test/groupedScreen.ts";

groupedScreen.it("a nested React input changes only low and submits a decoded triple", [], function* ({ enterLow, shownExpected, submit, saved }) {
	yield* enterLow("12");

	expect(yield* shownExpected()).toBe("20");

	yield* submit();

	expect(yield* saved()).toBe('{"energy":{"expected":20,"high":30,"low":12}}');
});

groupedScreen.it("a nested React input displays its validation error and refuses a save", [], function* ({ enterLow, submit, feedback, saved }) {
	yield* enterLow("wrong");
	yield* submit();

	yield* outcomes([
		["low feedback", () => feedback(), "Expected a finite number"],
		["save result", () => saved(), "unsaved"],
	]);
});
