import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationSettledFixture } from "#test/migrationSettledFixture.ts";

const LANES = { agents: ["task.agent"], answered: ["task.answered"], resolved: ["task.resolved"], you: [] };

boardStory.it(
	"asks in the current vocabulary sit in their Inbox lanes",
	[projectFiles(migrationSettledFixture(false)), deferredServing],
	function* ({ inboxLanes }) {
		expect(yield* inboxLanes()).toEqual(LANES);
	},
);

const legacy = [projectFiles(migrationSettledFixture(true)), deferredServing];

boardStory.it("migrating settled asks from the old vocabulary keeps every item in its Inbox lane", legacy, function* ({ inboxLanes, migrationRuns }) {
	yield* migrationRuns();

	expect(yield* inboxLanes()).toEqual(LANES);
});

boardStory.it("after migration an answered ask is still settled by the maintainer's answer", legacy, function* ({ answeredRecords, migrationRuns }) {
	yield* migrationRuns();

	expect(yield* answeredRecords()).toEqual([expect.objectContaining({ response: "answer.answered", yours: true })]);
});

boardStory.it("a second migration of settled asks changes no file", legacy, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(Object.keys(migrationSettledFixture(true)))).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

boardStory.it(
	"after migration, a change to an answered question's source sends its task back to the maintainer",
	legacy,
	function* ({ editorAppends, inboxLanes, migrationRuns }) {
		yield* migrationRuns();
		expect(yield* inboxLanes()).toMatchObject({ answered: ["task.answered"], you: [] });

		yield* editorAppends("responses/decision.answered.md", "\nA different question.\n");

		expect(yield* inboxLanes()).toMatchObject({ answered: [], you: ["task.answered"] });
	},
);
