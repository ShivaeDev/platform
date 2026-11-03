import { expect } from "vitest";
import { lessThan } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hostClock } from "#test/hostClock.ts";

hostClock.it(
	"a host advances a day in under a second and still serves worker writes and change hints",
	[],
	function* ({ elapsedMilliseconds, nextHint, read, daysPass, write }) {
		yield* write("Before the jump");
		expect(yield* nextHint()).toBe("changed the list");
		const before = yield* read();
		expect(before.notes).toEqual([{ title: "Before the jump", writtenAt: before.now }]);

		yield* daysPass(1);

		yield* outcomes([
			["wall time for the jump", () => elapsedMilliseconds(), lessThan(1000)],
			["host time after a day", () => read(), { now: before.now + 24 * 60 * 60 * 1000 }],
		]);

		yield* write("After the jump");

		yield* outcomes([
			["change hint", () => nextHint(), "changed the list"],
			[
				"worker writes on the advanced application clock",
				() => read(),
				{ notes: [...before.notes, { title: "After the jump", writtenAt: before.now + 24 * 60 * 60 * 1000 }] },
			],
		]);
	},
	{ timeout: 10_000 },
);

hostClock.it(
	"passing time leaves a later RetryAt asleep and returns after the due worker write finishes",
	[],
	function* ({ daysPass, deferWrite, read }) {
		const before = yield* read();
		yield* deferWrite("Publish tomorrow", 2);
		expect((yield* read()).notes).toEqual([]);

		yield* daysPass(1);

		expect((yield* read()).notes).toEqual([]);

		yield* daysPass(1);

		expect((yield* read()).notes).toEqual([{ title: "Publish tomorrow", writtenAt: before.now + 2 * 86_400_000 }]);
	},
	{ timeout: 10_000 },
);

hostClock.it("passing a day waits for due writes across worker batches", [], function* ({ daysPass, deferWrite, read }) {
	yield* deferWrite("First publication", 1);
	yield* deferWrite("Second publication", 1);
	expect((yield* read()).notes).toEqual([]);

	yield* daysPass(1);

	expect((yield* read()).notes.map(({ title }) => title).sort()).toEqual(["First publication", "Second publication"]);
});
