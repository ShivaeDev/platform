import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { vocabularyFixture } from "#test/vocabularyFixture.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";
import { afterFrontMatter } from "#test/workspaceReads.ts";

const vocabulary = [projectFiles(vocabularyFixture), fleetAcceptsEveryBrief, deferredServing];
const files = Object.keys(vocabularyFixture);

boardStory.it("migration reports how many files and fields it changed", vocabulary, function* ({ migrationReport }) {
	expect(yield* migrationReport()).toBe("Changed 12 files and 33 fields.\n");
});

boardStory.it("migration leaves the text after the front matter as written", vocabulary, function* ({ migrationRuns, savedBodies }) {
	yield* migrationRuns();

	expect(yield* savedBodies(files)).toEqual(
		Object.fromEntries(Object.entries(vocabularyFixture).map(([file, source]) => [file, afterFrontMatter(source)])),
	);
});

for (const [file, line] of [
	["successor.md", "  - kind: implements # retain this comment\n    target: goal\n"],
	["crlf.md", "kind: goal # retain comment\r\n"],
] as const) {
	boardStory.it(`migration keeps the comment and line endings in ${file}`, vocabulary, function* ({ migrationRuns, savedFile }) {
		yield* migrationRuns();

		expect(yield* savedFile(file)).toContain(line);
	});
}

boardStory.it("a second vocabulary migration changes no file", vocabulary, function* ({ migrationRuns, migrationRunsAgain }) {
	yield* migrationRuns();

	expect(yield* migrationRunsAgain(files)).toEqual({ changed: [], report: "Changed 0 files and 0 fields.\n" });
});

boardStory.it("every migrated document loads without problems", vocabulary, function* ({ diagnosedFiles, migrationRuns, start }) {
	yield* migrationRuns();
	yield* start();

	expect(yield* diagnosedFiles(files.filter((file) => file !== "fleet/status.md"))).toEqual([]);
});

for (const [file, metadata] of Object.entries({
	"captured.md": { urgency: "blocking" },
	"decisions/ruling.md": { kind: "question", owner: "claude", scope: "standing", status: "done" },
	"draft.md": { delivers: "report", fleet: "manual", kind: "task", owner: "codex", status: "draft" },
	"flow.md": { kind: "question", owner: "claude", scope: "task", status: "ready", urgency: "whenever" },
	"goal.md": { kind: "goal", owner: "claude", status: "ready" },
	"last-owner.md": { owner: "claude" },
	"question.md": { kind: "question", owner: "claude", scope: "task", status: "ready", urgency: "blocking" },
	"replaced.md": { owner: "claude", status: "dropped" },
	"report.md": { kind: "report", owner: "marvin", status: "done" },
	"successor.md": { owner: "claude" },
})) {
	boardStory.it(`after migration ${file} reads as ${JSON.stringify(metadata)}`, vocabulary, function* ({ itemMetadata, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		expect(yield* itemMetadata(`/${file}`)).toMatchObject(metadata);
	});
}

boardStory.it("after migration the goal shows the standing ruling's answer", vocabulary, function* ({ itemRulings, migrationRuns, start }) {
	yield* migrationRuns();
	yield* start();

	expect(yield* itemRulings("/_board/item/goal/")).toEqual([expect.objectContaining({ answer: "# Ruling\n\nUse the existing engine.\n" })]);
});

boardStory.it(
	"after migration a superseded_by field becomes a replaces link on the successor",
	vocabulary,
	function* ({ itemRelationships, migrationRuns, start }) {
		yield* migrationRuns();
		yield* start();

		expect(yield* itemRelationships("/_board/item/successor/")).toContain("replaces replaced");
	},
);
