import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationReplacementFixture } from "#test/migrationReplacementFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const replacements = [projectFiles(migrationReplacementFixture), fleetAcceptsEveryBrief, deferredServing];
const files = Object.keys(migrationReplacementFixture);
const UNRESOLVED =
	"Unresolved replacement: unknown.md: old.unknown -> task.missing\nUnresolved replacement: unnamed.md: old.unnamed -> <not named>\n";

boardStory.it("migration lists each replacement whose successor it cannot find", replacements, function* ({ migrationReport }) {
	expect(yield* migrationReport()).toEqual(expect.stringContaining(UNRESOLVED));
});

boardStory.it("migration keeps the comment on an existing relationship", replacements, function* ({ migrationRuns, savedFile }) {
	yield* migrationRuns();

	expect(yield* savedFile("current.md")).toContain("  - kind: relates_to # keep this comment\n    target: task.other\n");
});

boardStory.it(
	"a second migration changes no file and lists the unresolved replacements again",
	replacements,
	function* ({ migrationRuns, migrationRunsAgain }) {
		yield* migrationRuns();

		expect(yield* migrationRunsAgain(files)).toEqual({ changed: [], report: `Changed 0 files and 0 fields.\n${UNRESOLVED}` });
	},
);

boardStory.it(
	"migration links every replacement named in a next action or a legacy field",
	replacements,
	function* ({ itemDiagnostics, itemRelationships, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		yield* outcomes([
			["problems", () => itemDiagnostics("/current.md"), []],
			[
				"relationships",
				() => itemRelationships("/current.md"),
				[
					"relates_to task.other",
					"replaces old.already",
					"replaces old.comma",
					"replaces old.done",
					"replaces old.dropped",
					"replaces old.legacy",
					"replaces old.multiple",
					"replaces old.pr",
					"replaces old.the",
					"replaces old.which",
					"replaces old.superseded",
				],
			],
		]);
	},
);

for (const [file, relationships] of [
	["other.md", ["replaces old.comma", "replaces old.field", "replaces old.multiple"]],
	["which.md", ["replaces old.comma"]],
] as const) {
	boardStory.it(
		`migration links ${file} only to the items it names as replaced`,
		replacements,
		function* ({ itemRelationships, migrationRuns, start }) {
			yield* migrationRuns();
			yield* start();

			expect(yield* itemRelationships(`/${file}`)).toEqual(relationships);
		},
	);
}
