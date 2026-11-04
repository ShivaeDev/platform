import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldBy, lockStory, waiting } from "#test/kit.ts";
import { gitUnavailable, heldByAnotherProcess, hungAfter } from "#test/waiting.ts";

lockStory.it(
	"a waiter names the branch recorded by a holder in another process",
	[heldByAnotherProcess("feature/holder")],
	function* ({ printedBy, starts }) {
		yield* starts("ready");

		expect(yield* printedBy("ready")).toEqual([expect.stringContaining("on branch feature/holder since <time> (0s)")]);
	},
);

lockStory.it(
	"a holder in another process may be hung once its hold reaches the default fifteen minutes",
	[heldByAnotherProcess("feature/holder")],
	function* ({ lock, printedBy, starts, stateOf, timePasses }) {
		yield* timePasses(14 * 60_000);
		yield* starts("ready");
		yield* timePasses(59_999);
		expect(yield* printedBy("ready")).toEqual([expect.stringContaining("on branch feature/holder since <time> (14m 0s)")]);

		yield* timePasses(1);

		yield* outcomes([
			[
				"printed by ready",
				() => printedBy("ready"),
				[
					expect.stringContaining("on branch feature/holder since <time> (14m 0s)"),
					expect.stringContaining("on branch feature/holder since <time> (15m 0s); holder may be hung"),
				],
			],
			["ready's state", () => stateOf("ready"), "waiting"],
			["lock holder", () => lock.holder(), "holder"],
		]);
		yield* timePasses(60_000);

		expect((yield* printedBy("ready")).at(-1)).toContain("(16m 0s); holder may be hung");
	},
);

lockStory.it(
	"a configured hung threshold warns at the next poll even before the minute reminder",
	[hungAfter(20_000), heldByAnotherProcess("feature/slow")],
	function* ({ printedBy, starts, timePasses }) {
		yield* starts("ready");
		yield* timePasses(19_999);
		expect(yield* printedBy("ready")).toEqual([expect.stringContaining("on branch feature/slow since <time> (0s)")]);

		yield* timePasses(1);

		expect(yield* printedBy("ready")).toEqual([
			expect.stringContaining("on branch feature/slow since <time> (0s)"),
			expect.stringContaining("on branch feature/slow since <time> (20s); holder may be hung"),
		]);
	},
);

for (const { description, traits } of [
	{ description: "outside Git", traits: [heldByAnotherProcess()] },
	{ description: "with detached HEAD", traits: [heldByAnotherProcess("feature/detached", true)] },
	{ description: "without Git installed", traits: [gitUnavailable(), heldByAnotherProcess("feature/unavailable")] },
]) {
	lockStory.it(
		`a holder ${description} still holds the lock and a waiter still warns about its age`,
		[hungAfter(0), ...traits],
		function* ({ printedBy, starts }) {
			yield* starts("ready");

			expect(yield* printedBy("ready")).toEqual([expect.stringMatching(/ in .*\/repository since <time> \(0s\); holder may be hung$/u)]);
		},
	);
}

lockStory.it(
	"a new holder clears the previous holder's hung warning and an old holder file without a branch remains readable",
	[hungAfter(20_000), heldBy("build"), waiting("ready")],
	function* ({ lock, printedBy, starts, timePasses }) {
		yield* timePasses(20_000);
		expect(yield* printedBy("ready")).toContainEqual(expect.stringContaining("(20s); holder may be hung"));
		yield* lock.releases("build");
		yield* starts("typecheck");

		yield* timePasses(10_000);

		expect((yield* printedBy("ready")).at(-1)).toMatch(/running `pnpm typecheck` .* since <time> \(10s\)$/u);
	},
);
