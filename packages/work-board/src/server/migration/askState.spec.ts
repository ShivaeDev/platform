import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationAskStateFixture } from "#test/migrationDecisionFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const asks = [projectFiles(migrationAskStateFixture), fleetAcceptsEveryBrief, deferredServing];

boardStory.it("a second migration of Fleet asks changes no file", asks, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(Object.keys(migrationAskStateFixture))).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

for (const [id, status, urgency, why] of [
	["selected", "ready", "blocking", "stays open although it has a selection-only answer"],
	["multiple", "done", "whenever", "is closed by its own state"],
	["written", "ready", "blocking", "stays open although it has a written answer"],
	["closed", "done", "whenever", "is closed by its own state"],
]) {
	boardStory.it(
		`after migration the Fleet ask ${id} ${why}, as a task question without an answer field`,
		asks,
		function* ({ itemDiagnostics, itemMetadata, migrationRuns, start }) {
			yield* migrationRuns();
			yield* start();

			yield* outcomes({
				"answer field": [itemMetadata(`/_board/item/fleet.${id}/`), expect.not.objectContaining({ answer: expect.anything() })],
				metadata: [itemMetadata(`/_board/item/fleet.${id}/`), expect.objectContaining({ kind: "question", scope: "task", status, urgency })],
				problems: [itemDiagnostics(`/_board/item/fleet.${id}/`), []],
			});
		},
	);
}

boardStory.it(
	"after migration a selection-only answer is still recorded on its ask",
	asks,
	function* ({ itemResponseAnswers, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		expect(yield* itemResponseAnswers("/_board/item/fleet.selected/")).toContainEqual({ prompt: "choice", selected: ["release"], text: "" });
	},
);

boardStory.it("after migration only the task with an open ask and no answer waits in the Inbox", asks, function* ({ inboxLanes, migrationRuns }) {
	yield* migrationRuns();

	expect(yield* inboxLanes()).toMatchObject({ you: ["task.written"] });
});

for (const id of ["selected", "multiple", "written", "closed"]) {
	boardStory.it(
		`after migration the Fleet ask on task.${id} is not shown as a standing ruling`,
		asks,
		function* ({ itemRulings, migrationRuns, start }) {
			yield* migrationRuns();
			yield* start();

			expect(yield* itemRulings(`/_board/item/task.${id}/`)).toEqual([]);
		},
	);
}
