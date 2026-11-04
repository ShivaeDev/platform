import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { groupedForm } from "#test/groupedForm.ts";

groupedForm.it(
	"a nested field edit preserves its siblings and submits decoded numbers",
	[],
	function* ({ enterLow, low, shownValues, submit, serverReceived }) {
		yield* enterLow("12");

		yield* outcomes([
			["nested input ref", () => low(), "12"],
			["encoded form", () => shownValues(), { energy: { expected: "20", high: "30", low: "12" } }],
		]);

		yield* submit();

		expect(yield* serverReceived()).toEqual([{ energy: { expected: 20, high: 30, low: 12 } }]);
	},
);

groupedForm.it(
	"a nested field change reveals its own validation error and leaves its sibling clear",
	[],
	function* ({ enterLow, feedbackAt, validate }) {
		yield* enterLow("wrong");
		yield* validate();

		yield* outcomes([
			["low feedback", () => feedbackAt(["energy", "low"]), "Expected a finite number"],
			["expected feedback", () => feedbackAt(["energy", "expected"]), undefined],
		]);
	},
);

groupedForm.it("reverting a nested field restores the latest received group", [], function* ({ enterLow, refresh, revert, shownValues }) {
	yield* enterLow("12");
	yield* refresh({ energy: { expected: "25", high: "35", low: "15" } });

	yield* revert();

	expect(yield* shownValues()).toEqual({ energy: { expected: "25", high: "35", low: "15" } });
});
