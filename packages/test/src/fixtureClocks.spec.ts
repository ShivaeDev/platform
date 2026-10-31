import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { greetingApp, liveGreetingApp } from "#test/greetingFixture.ts";

greetingApp("a fixture without a clock option runs its tests on the test clock from 0 ms", function* ({ clock }) {
	expect(yield* clock()).toBe("the test clock at 0 ms");
});

greetingApp(
	"a test's live clock option puts its harness and body on the live clock",
	function* ({ clock, harnessClock }) {
		yield* outcomes({
			"body's clock": [clock(), "the live clock"],
			"harness's clock": [harnessClock(), "the live clock"],
		});
	},
	{ clock: "live" },
);

liveGreetingApp("a fixture with the live clock option runs its tests on the live clock", function* ({ clock }) {
	expect(yield* clock()).toBe("the live clock");
});

liveGreetingApp(
	"a test's test clock option puts its harness and body on the test clock from 0 ms in a live fixture",
	function* ({ clock, harnessClock }) {
		yield* outcomes({
			"body's clock": [clock(), "the test clock at 0 ms"],
			"harness's clock": [harnessClock(), "the test clock at 0 ms"],
		});
	},
	{ clock: "test" },
);

greetingApp("the file's Layer is acquired on the live clock while the harness is made on the test clock", function* ({ harnessClock, layerClock }) {
	yield* outcomes({
		"harness's clock": [harnessClock(), "the test clock at 0 ms"],
		"Layer's clock": [layerClock(), "the live clock"],
	});
});
