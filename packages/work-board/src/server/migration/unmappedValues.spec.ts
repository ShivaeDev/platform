import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { releasedApprovalFixture, unmappedBoard, unmappedCases } from "#test/migrationValuesFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

for (const { field, value, kind } of unmappedCases) {
	const files = unmappedBoard(field, value, kind);
	boardStory.it(
		`an unmapped ${kind} ${field} value ${JSON.stringify(value)} fails the migration before any file is rewritten`,
		[projectFiles(files), fleetAcceptsEveryBrief, deferredServing],
		function* ({ failedMigration, savedFiles }) {
			yield* outcomes({
				files: [savedFiles(Object.keys(files)), files],
				migration: [failedMigration(), { errors: expect.stringContaining(`z-unknown.md: ${field}: ${JSON.stringify(value)}`), exit: "failed" }],
			});
		},
	);
}

const released = [projectFiles(releasedApprovalFixture), fleetAcceptsEveryBrief, deferredServing];

boardStory.it("migration turns Fleet's released approval back into held", released, function* ({ migrationReport }) {
	expect(yield* migrationReport()).toBe("Changed 1 files and 1 fields.\n");
});

boardStory.it("a second migration of a released approval changes no file", released, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(Object.keys(releasedApprovalFixture))).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

boardStory.it(
	"after migration a released approval loads as a held ready task",
	released,
	function* ({ itemDiagnostics, itemMetadata, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		yield* outcomes({
			metadata: [itemMetadata("/released.md"), expect.objectContaining({ fleet: "held", status: "ready" })],
			problems: [itemDiagnostics("/released.md"), []],
		});
	},
);
