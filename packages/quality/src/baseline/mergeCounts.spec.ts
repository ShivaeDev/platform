import { expect } from "@effect/vitest";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { ALPHA_SHARD, branchEdits, driverInstalled, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

baselineStory.it(
	"the driver keeps an entry removed on one branch removed when the other branch lowers it",
	[
		packageWorkspace(),
		shardsRecorded(),
		driverInstalled(),
		branchEdits("lower", { lowers: { "a.ts": 1 } }),
		branchEdits("remove", { removes: ["a.ts"] }),
	],
	function* ({ merges, recorded }) {
		const result = yield* merges("lower");

		expect(result).toBe("merged");
		expect(yield* recorded(ALPHA_SHARD)).toEqual(["packages/alpha/src/b.ts structure/max-lines 3", "packages/alpha/src/c.ts structure/max-lines 3"]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"the driver takes the lower of two branches' counts and keeps the entries each branch added",
	[
		packageWorkspace(),
		shardsRecorded(),
		driverInstalled(),
		branchEdits("left", { adds: { "d.ts": 2 }, lowers: { "a.ts": 1 } }),
		branchEdits("right", { adds: { "e.ts": 4 }, lowers: { "a.ts": 2 } }),
	],
	function* ({ merges, recorded }) {
		const result = yield* merges("left");

		expect(result).toBe("merged");
		expect(yield* recorded(ALPHA_SHARD)).toEqual([
			"packages/alpha/src/a.ts structure/max-lines 1",
			"packages/alpha/src/b.ts structure/max-lines 3",
			"packages/alpha/src/c.ts structure/max-lines 3",
			"packages/alpha/src/d.ts structure/max-lines 2",
			"packages/alpha/src/e.ts structure/max-lines 4",
		]);
	},
	CLI_TIMEOUT,
);
