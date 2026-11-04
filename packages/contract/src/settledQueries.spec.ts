import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldAnswer, settledQueryStory } from "#test/settledQueryStory.ts";

settledQueryStory.it(
	"the readout waits for a held query to settle",
	[heldAnswer],
	function* ({ watch, requestReceived, latest, releaseAnswer, next }) {
		yield* watch("reader");
		yield* requestReceived();
		expect(yield* latest("reader")).toBe("still loading");

		yield* releaseAnswer();

		expect(yield* next("reader")).toBe("First");
	},
);

for (const value of ["First", "Second"]) {
	settledQueryStory.it(
		`the queued and current readouts receive a settled refresh with ${value === "First" ? "the same" : "a new"} value`,
		[],
		function* ({ watch, next, latest, announce }) {
			yield* watch("reader");
			expect(yield* next("reader")).toBe("First");

			yield* announce(value);

			yield* outcomes([
				["queued result", () => next("reader"), value],
				["current result", () => latest("reader"), value],
			]);
		},
	);
}

settledQueryStory.it("the readout preserves a settled query failure", [], function* ({ watch, next, failRead }) {
	yield* watch("reader");
	expect(yield* next("reader")).toBe("First");

	yield* failRead();

	expect(yield* next("reader")).toBe("failed with read failed");
});

settledQueryStory.it("closing one scope leaves another scope reading settled queries", [], function* ({ watch, next, stop, announce }) {
	yield* watch("first");
	expect(yield* next("first")).toBe("First");
	yield* watch("second");
	expect(yield* next("second")).toBe("First");

	yield* stop("first");
	yield* announce("Second");

	expect(yield* next("second")).toBe("Second");
});

settledQueryStory.it("closing the observation scope releases its registry subscription", [], function* ({ watch, next, stop, subscribed }) {
	yield* watch("reader");
	yield* next("reader");
	expect(yield* subscribed()).toBe(true);

	yield* stop("reader");

	expect(yield* subscribed()).toBe(false);
});
