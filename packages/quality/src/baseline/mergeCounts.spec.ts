import { expect } from "@effect/vitest";
import { baselineStory } from "#test/baselineStory.ts";
import { ALPHA_SHARD, branchEdits, branchShard, driverInstalled, packageWorkspace, shardCommitted, shardsRecorded } from "#test/packageWorkspace.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

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

const SHARD_KEYS = ["path", "rule", "count", "deep"];

function split(count: number, deep?: number): string {
	return JSON.stringify({ count, ...(deep === undefined ? {} : { deep }), path: "packages/alpha/src/a.ts", rule: "effect/boundary" }, SHARD_KEYS);
}

for (const [name, left, right, expected] of [
	["takes the lower fast share and the lower deep share of a split entry and writes their sum", split(4, 2), split(4, 1), split(3, 1)],
	["takes the lower total of a split entry and drops the deep share when one branch has not recorded it", split(4), split(3, 1), split(3)],
] as const) {
	baselineStory.it(
		`the driver ${name}`,
		[packageWorkspace(), shardCommitted([split(5, 2)]), driverInstalled(), branchShard("left", [left]), branchShard("right", [right])],
		function* ({ merges, reads }) {
			const result = yield* merges("left");

			expect(result).toBe("merged");
			expect(yield* reads(ALPHA_SHARD)).toBe(`${expected}\n`);
		},
		CLI_TIMEOUT,
	);
}
