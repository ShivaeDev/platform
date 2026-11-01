import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { ALPHA_SHARD, branchEdits, branchWrites, driverInstalled, merged, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

baselineStory.it(
	"baseline install-driver adds the merge.quality-baseline.driver setting to the repository's local config and changes nothing else",
	[packageWorkspace()],
	function* ({ localConfig, runs }) {
		const before = yield* localConfig();

		yield* runs("baseline", "install-driver");

		expect(yield* localConfig()).toEqual([...before, expect.stringMatching(/^merge\.quality-baseline\.driver=.* baseline merge "%O" "%A" "%B"$/u)]);
	},
	CLI_TIMEOUT,
);

for (const conflict of [false, true]) {
	baselineStory.it(
		`the driver merges a three-way baseline shard without leaving temporary files after a ${conflict ? "conflicting" : "clean"} merge`,
		[
			packageWorkspace(),
			shardsRecorded(),
			driverInstalled(),
			branchEdits("left", { removes: ["a.ts"] }),
			branchEdits("right", { removes: ["b.ts"] }),
			...(conflict ? [branchWrites("left", "src/root.ts", 'String("left");\n'), branchWrites("right", "src/root.ts", 'String("right");\n')] : []),
		],
		function* ({ merges, recorded, rootFiles }) {
			const before = yield* rootFiles();

			const result = yield* merges("left");

			expect(result).toBe(conflict ? "conflicted" : "merged");
			yield* outcomes([
				["merged shard", () => recorded(ALPHA_SHARD), ["packages/alpha/src/c.ts structure/max-lines 3"]],
				["repository root files", () => rootFiles(), before],
			]);
		},
		CLI_TIMEOUT,
	);
}

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

baselineStory.it(
	"baseline tighten deletes the shard that branches emptied between them",
	[
		packageWorkspace(),
		shardsRecorded(),
		driverInstalled(),
		branchEdits("left", { removes: ["a.ts"] }),
		branchEdits("right", { removes: ["b.ts", "c.ts"] }),
		merged("left"),
	],
	function* ({ recorded, runs }) {
		expect(yield* recorded(ALPHA_SHARD)).toEqual([]);

		yield* runs("baseline", "tighten");

		expect(yield* recorded(ALPHA_SHARD)).toBe("no baseline file");
	},
	CLI_TIMEOUT,
);
