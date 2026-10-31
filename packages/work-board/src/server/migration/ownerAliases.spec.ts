import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { ownerAliasFixture } from "#test/migrationValuesFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const aliases = [projectFiles(ownerAliasFixture), fleetAcceptsEveryBrief, deferredServing];
const files = Object.keys(ownerAliasFixture);

boardStory.it(
	"migration folds owner aliases in any letter case into marvin, claude and codex, each loading without problems",
	aliases,
	function* ({ documentOwners, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		expect(yield* documentOwners(files)).toEqual({
			"0.md": "marvin",
			"1.md": "marvin",
			"2.md": "marvin",
			"3.md": "claude",
			"4.md": "claude",
			"5.md": "claude",
			"6.md": "claude",
			"7.md": "claude",
			"8.md": "codex",
			"9.md": "codex",
		});
	},
);

boardStory.it("a second migration of owner aliases changes no file", aliases, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(files)).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});
