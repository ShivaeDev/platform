import { expect } from "vitest";
import { pinnedKit } from "#test/pinnedKit.ts";

pinnedKit.it("runs a pinned kit's create, after and step hooks on the pinned clock", [], function* ({ clockReadings, stepsOnce }) {
	yield* stepsOnce();

	expect(clockReadings()).toEqual(["create on the pinned clock", "after on the pinned clock", "step on the pinned clock"]);
});

pinnedKit.it(
	"runs a pinned kit's create, after and step hooks on the test clock when the story asks for it",
	[],
	function* ({ clockReadings, stepsOnce }) {
		yield* stepsOnce();

		expect(clockReadings()).toEqual(["create on the test clock at zero", "after on the test clock at zero", "step on the test clock at zero"]);
	},
	{ clock: "test" },
);
