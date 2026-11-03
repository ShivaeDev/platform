import { expect } from "@effect/vitest";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { ALPHA_SHARD, branchEdits, driverInstalled, merged, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

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
