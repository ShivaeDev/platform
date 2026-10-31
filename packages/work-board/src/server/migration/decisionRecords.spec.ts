import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationDecisionFixture } from "#test/migrationDecisionFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";
import { afterFrontMatter } from "#test/workspaceReads.ts";

const decisions = [projectFiles(migrationDecisionFixture), fleetAcceptsEveryBrief, deferredServing];
const files = Object.keys(migrationDecisionFixture);

boardStory.it(
	"migrating decision records changes only front matter and removes every answer field",
	decisions,
	function* ({ migrationRuns, savedBodies, savedFilesMatching }) {
		yield* migrationRuns();

		yield* outcomes({
			"files with an answer field": [savedFilesMatching(files, /^answer:/mu), []],
			"text after the front matter": [
				savedBodies(files),
				Object.fromEntries(Object.entries(migrationDecisionFixture).map(([file, source]) => [file, afterFrontMatter(source)])),
			],
		});
	},
);

boardStory.it("a second migration of decision records changes no file", decisions, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(files)).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

for (const id of ["fleet.open", "fleet.deferred", "unruled"]) {
	boardStory.it(
		`after migration the unanswered ask ${id} is an open blocking task question`,
		decisions,
		function* ({ itemDiagnostics, itemMetadata, migrationRuns, start }) {
			yield* migrationRuns();
			yield* start();

			yield* outcomes({
				"answer field": [itemMetadata(`/_board/item/${id}/`), expect.not.objectContaining({ answer: expect.anything() })],
				metadata: [
					itemMetadata(`/_board/item/${id}/`),
					expect.objectContaining({ kind: "question", scope: "task", status: "ready", urgency: "blocking" }),
				],
				problems: [itemDiagnostics(`/_board/item/${id}/`), []],
			});
		},
	);
}

boardStory.it(
	"after migration an answered ask is done and takes its answer from the response record",
	decisions,
	function* ({ itemMetadata, itemResponseBodies, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		yield* outcomes({
			metadata: [itemMetadata("/_board/item/fleet.answered/"), expect.objectContaining({ kind: "question", scope: "task", status: "done" })],
			responses: [itemResponseBodies("/_board/item/fleet.answered/"), expect.arrayContaining(["Use the current branch.\n"])],
		});
	},
);

boardStory.it("after migration the tasks of unanswered asks wait in the Inbox", decisions, function* ({ inboxLanes, migrationRuns }) {
	yield* migrationRuns();

	expect(yield* inboxLanes()).toMatchObject({ you: ["task.deferred", "task.open", "unruled"] });
});

boardStory.it(
	"after migration only the maintainer's ruling becomes a standing ruling on its task",
	decisions,
	function* ({ itemMetadata, itemRulings, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		yield* outcomes({
			ruling: [itemMetadata("/_board/item/storage/"), expect.objectContaining({ owner: "marvin", scope: "standing", status: "done" })],
			"task rulings": [
				itemRulings("/task.md"),
				[{ answer: "# Storage ruling\n\nKeep PostgreSQL.\n", href: "/decisions/storage.md", title: "Storage ruling" }],
			],
		});
	},
);

boardStory.it("after migration the library lists no answer file for a Fleet ask", decisions, function* ({ fleetLibraryPaths, migrationRuns }) {
	yield* migrationRuns();

	expect(yield* fleetLibraryPaths()).toEqual(expect.not.arrayContaining([expect.stringContaining("answer.fleet.")]));
});
