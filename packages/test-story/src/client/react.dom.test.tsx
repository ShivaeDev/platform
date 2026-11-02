import { afterAll, expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { isolatedMounts, pendingResultScreen, testing, warningRestoration } from "#test/reactRendering.ts";

afterAll(() => {
	expect(warningRestoration()).toBe("restored");
});

testing.it(
	"eventually reports the last assertion and elapsed live time",
	[pendingResultScreen()],
	function* ({ retriesUnreadyScreen, waitReport, storyTime }) {
		yield* retriesUnreadyScreen();

		const report = yield* waitReport();
		expect(report.elapsed).toBeGreaterThanOrEqual(3000);
		expect(report.attempts).toBeGreaterThan(1);
		expect(report.retainedLastObservation).toBe(true);
		expect(report.failure).toContain(report.lastObservation);
		expect(report.reportedElapsed).toBeGreaterThanOrEqual(3000);
		expect(report.reportedElapsed).toBeLessThanOrEqual(report.elapsed);
		expect(yield* storyTime()).toBe(0);
	},
	{ clock: "test" },
);
testing.it(
	"yieldable assertions let native atom results render without advancing the story clock",
	[pendingResultScreen()],
	function* ({ answer, waitsForText, shown, storyTime }) {
		expect(yield* shown()).toBe("");

		yield* answer("Morning walk");
		yield* waitsForText("Morning walk");

		expect(yield* shown()).toBe("Morning walk");
		expect(yield* storyTime()).toBe(0);
	},
	{ clock: "test" },
);
testing.it("mounts isolate native atom registries", [isolatedMounts()], function* ({ shown, registrySharing, resources }) {
	yield* outcomes([
		["registry sharing", () => registrySharing(), "isolated"],
		["first screen", () => shown("first"), "first:1"],
		["second screen", () => shown("second"), "second:2"],
		["native resources", () => resources(), { acquired: 2, released: 0 }],
	]);
});

testing.it("rerender preserves the mount's native resources", [isolatedMounts()], function* ({ shown, resources, relabel }) {
	expect(yield* shown("first")).toBe("first:1");

	yield* relabel("updated:");

	yield* outcomes([
		["rerendered screen", () => shown("first"), "updated:1"],
		["native resources", () => resources(), { acquired: 2, released: 0 }],
	]);
});

testing.it(
	"unmount disposes each mount's native resources only once",
	[isolatedMounts()],
	function* ({ shown, attachment, resources, closeFirst, closeSecond }) {
		expect((yield* resources()).released).toBe(0);

		yield* closeFirst();

		yield* outcomes([
			["first mount", () => attachment("first"), "detached"],
			["first screen", () => shown("first"), ""],
			["released resources", () => resources(), { released: 1 }],
			["second screen", () => shown("second"), "second:2"],
		]);

		yield* closeFirst();

		expect((yield* resources()).released).toBe(1);

		yield* closeSecond();

		expect((yield* resources()).released).toBe(2);
	},
);

testing.it.fails("console.error fails a story", [], function* ({ warn }) {
	yield* warn();
});
