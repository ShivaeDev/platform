import { expect } from "vitest";
import { lessThan } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hostClock } from "#test/hostClock.ts";

hostClock.it(
	"a host advances seven days in under three seconds and still serves worker writes and change hints",
	[],
	function* ({ elapsedMilliseconds, nextHint, read, sevenDaysPass, write }) {
		yield* write("Before the jump");
		expect(yield* nextHint()).toBe("changed the list");
		const before = yield* read();
		expect(before.notes).toEqual([{ title: "Before the jump", writtenAt: before.now }]);

		yield* sevenDaysPass();

		yield* outcomes([
			["wall time for the jump", () => elapsedMilliseconds(), lessThan(3000)],
			["host time after seven days", () => read(), { now: before.now + 7 * 24 * 60 * 60 * 1000 }],
		]);

		yield* write("After the jump");

		yield* outcomes([
			["change hint", () => nextHint(), "changed the list"],
			[
				"worker writes on the advanced application clock",
				() => read(),
				{ notes: [...before.notes, { title: "After the jump", writtenAt: before.now + 7 * 24 * 60 * 60 * 1000 }] },
			],
		]);
	},
	{ timeout: 10_000 },
);
