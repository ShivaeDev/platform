import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

vitestRun.it("a fixture body's typed failure fails its test with that failure", [], function* ({ outcome, runs }) {
	yield* runs("a body that fails holding its resource");

	expect(yield* outcome()).toBe("failed: the body failed");
});

vitestRun.it("an it.effect body's typed failure fails its test with that failure", [], function* ({ outcome, runs }) {
	yield* runs("an it.effect body that fails");

	expect(yield* outcome()).toBe("failed: the body failed");
});

vitestRun.it("a fixture body that runs past its 25 ms timeout fails its test as timed out", [], function* ({ outcome, runs }) {
	yield* runs("a body that never finishes");

	expect(yield* outcome()).toBe("failed: Test timed out in 25ms.");
});

vitestRun.it("a Layer that fails during worker startup fails the file's test with its error", [], function* ({ outcome, runs }) {
	yield* runs("a test of a worker whose Layer fails to start");

	expect(yield* outcome()).toBe("failed: database connection refused during worker startup");
});

vitestRun.it("an it.effect test behind a true skip condition is skipped without running its body", [], function* ({ lifecycle, outcome, runs }) {
	yield* runs("an it.effect body behind a true skip condition");

	yield* outcomes([
		["lifecycle", () => lifecycle(), []],
		["outcome", () => outcome(), "skipped"],
	]);
});

vitestRun.it("it stays Vitest's plain tester for a test without Effect", [], function* ({ lifecycle, outcome, runs }) {
	yield* runs("a plain Vitest test");

	yield* outcomes([
		["lifecycle", () => lifecycle(), ["the plain test ran"]],
		["outcome", () => outcome(), "passed"],
	]);
});

vitestRun.it("it.effect.each passes each case to its own run of the body", [], function* ({ lifecycle, runs }) {
	yield* runs("it.effect.each case alpha", "it.effect.each case beta");

	expect(yield* lifecycle()).toEqual(["the body received alpha", "the body received beta"]);
});
