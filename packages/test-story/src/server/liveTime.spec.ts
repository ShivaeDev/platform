import { expect } from "vitest";
import { liveKit } from "#test/liveKit.ts";

liveKit.it("runs a live kit's create, after and step hooks on the live clock", [], function* ({ clockReadings, stepsOnce }) {
	yield* stepsOnce();

	expect(clockReadings()).toEqual(["create on the live clock", "after on the live clock", "step on the live clock"]);
});

liveKit.it(
	"runs a live kit's create, after and step hooks on the test clock when the story asks for it",
	[],
	function* ({ clockReadings, stepsOnce }) {
		yield* stepsOnce();

		expect(clockReadings()).toEqual(["create on the test clock at zero", "after on the test clock at zero", "step on the test clock at zero"]);
	},
	{ clock: "test" },
);
