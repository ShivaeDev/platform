import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { ALPHA_SHARD, branchEdits, branchWrites, driverInstalled, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

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
