import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { agedMergeInputs, mergeLeftovers } from "#test/mergeFiles.ts";
import { ALPHA_SHARD, branchEdits, branchWrites, driverInstalled, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

for (const oldInputs of [false, true]) {
	baselineStory.it(
		`the driver removes stale root leftovers, preserves tracked, recent and unrelated files and merges correctly with ${oldInputs ? "old" : "fresh"} inputs`,
		[
			packageWorkspace(),
			shardsRecorded(),
			driverInstalled(),
			branchEdits("left", { removes: ["a.ts"] }),
			branchEdits("right", { removes: ["b.ts"] }),
			mergeLeftovers(),
			...(oldInputs ? [agedMergeInputs()] : []),
		],
		function* ({ merges, reads, recorded, rootFiles }) {
			const before = yield* rootFiles();
			const nested = yield* reads("packages/alpha/.merge_file_nested");
			expect(before).toContain(".merge_file_stale");
			expect(nested).toBeDefined();

			const result = yield* merges("left");

			expect(result).toBe("merged");
			yield* outcomes([
				["merged shard", () => recorded(ALPHA_SHARD), ["packages/alpha/src/c.ts structure/max-lines 3"]],
				["remaining root files", () => rootFiles(), before.filter((name) => name !== ".merge_file_stale")],
				["nested file", () => reads("packages/alpha/.merge_file_nested"), nested],
			]);
		},
		CLI_TIMEOUT,
	);
}

baselineStory.it(
	"a rejected baseline merge removes stale leftovers without leaving new temporary files",
	[
		packageWorkspace(),
		shardsRecorded(),
		driverInstalled(),
		branchEdits("left", { removes: ["a.ts"] }),
		branchEdits("right", { removes: ["b.ts"] }),
		branchWrites("right", ALPHA_SHARD, "invalid baseline\n"),
		mergeLeftovers(),
	],
	function* ({ merges, rootFiles }) {
		const before = yield* rootFiles();
		expect(before).toContain(".merge_file_stale");

		const result = yield* merges("left");

		expect(result).toBe("conflicted");
		expect(yield* rootFiles()).toEqual(before.filter((name) => name !== ".merge_file_stale"));
	},
	CLI_TIMEOUT,
);
