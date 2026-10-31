import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationFormatFixture } from "#test/migrationFormatFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const formats = [projectFiles(migrationFormatFixture), fleetAcceptsEveryBrief, deferredServing];
const files = Object.keys(migrationFormatFixture);

for (const [file, what, migrated] of [
	[
		"plain.md",
		"rewrites plain YAML values in place and adds the replacement as a flow relationship",
		migrationFormatFixture["plain.md"]
			.replace("project", "goal")
			.replace("active", "ready")
			.replace("Claude", "claude")
			.replace("fleet-deliverable", "delivers")
			.replace("---\n# Plain", 'relationships: [{"kind":"replaces","target":"dropped"}]\n---\n# Plain'),
	],
	[
		"quoted.md",
		"rewrites quoted YAML values keeping their quotes",
		migrationFormatFixture["quoted.md"]
			.replace("project", "goal")
			.replace("active", "ready")
			.replace("Claude", "claude")
			.replace("fleet-deliverable", "delivers"),
	],
	["response.md", "removes the retired response kind line whole", migrationFormatFixture["response.md"].replace("kind: response\n", "")],
	[
		"dropped.md",
		"turns superseded into dropped and removes the superseded_by line",
		migrationFormatFixture["dropped.md"].replace("superseded\n", "dropped\n").replace("superseded_by: plain\n", ""),
	],
] as const) {
	boardStory.it(`migration of ${file} ${what}`, formats, function* ({ migrationRuns, savedFile }) {
		yield* migrationRuns();

		expect(yield* savedFile(file)).toBe(migrated);
	});
}

boardStory.it("migration writes valid JSON properties into JSON front matter", formats, function* ({ migrationRuns, savedJsonFrontMatter }) {
	yield* migrationRuns();

	expect(yield* savedJsonFrontMatter("json.md")).toMatchObject({
		delivers: "report",
		kind: "question",
		owner: "claude",
		scope: "task",
		status: "done",
		urgency: "whenever",
	});
});

boardStory.it("a second migration of every front matter style changes no file", formats, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(files)).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

boardStory.it("every front matter style loads without problems after migration", formats, function* ({ diagnosedFiles, migrationRuns, start }) {
	yield* migrationRuns();
	yield* start();

	expect(yield* diagnosedFiles(files)).toEqual([]);
});
