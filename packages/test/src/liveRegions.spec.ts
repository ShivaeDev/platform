import { expect } from "vitest";
import { atLeast } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveRegion } from "#test/liveRegion.ts";

liveRegion.it("under the test clock, a live region runs on the live clock", [], function* ({ clockInRegion, runsLiveRegion }) {
	yield* runsLiveRegion("succeeds");

	expect(yield* clockInRegion()).toBe("the live clock");
});

for (const [ending, answer] of [
	["succeeds", "ready"],
	["fails", "failed with not ready"],
] as const) {
	liveRegion.it(
		`a live region that ${ending} answers "${answer}" and leaves the story on its test clock at 0 ms`,
		[],
		function* ({ answer: answered, clock, runsLiveRegion }) {
			yield* runsLiveRegion(ending);

			yield* outcomes([
				["answer", () => answered(), answer],
				["clock after the region", () => clock(), "the test clock at 0 ms"],
			]);
		},
	);
}

liveRegion.it(
	"under the live clock, a live region runs as it is",
	[],
	function* ({ answer, clockInRegion, runsLiveRegion }) {
		yield* runsLiveRegion("succeeds");

		yield* outcomes([
			["answer", () => answer(), "ready"],
			["clock in the region", () => clockInRegion(), "the live clock"],
		]);
	},
	{ clock: "live" },
);

liveRegion.it("a real wait in withLive leaves virtual time unchanged", [], function* ({ clock, realWaitMillis, waitsInLiveTime }) {
	expect(yield* clock()).toBe("the test clock at 0 ms");

	yield* waitsInLiveTime();

	yield* outcomes([
		["real milliseconds spent waiting", () => realWaitMillis(), atLeast(20)],
		["virtual clock after waiting", () => clock(), "the test clock at 0 ms"],
	]);
});
