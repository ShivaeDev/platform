import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { navigationFixture } from "#test/navigationFixture.ts";

const project = [projectFiles(navigationFixture()), boardHome("packages/README.md")];

boardStory.it("navigation answers compact destination counts, the home and the Inbox count", project, function* ({ navigationRead }) {
	expect(yield* navigationRead("packages/form/README.md")).toEqual({
		counts: { goals: 0, library: 7, now: 0, system: expect.any(Number) },
		home: { file: "packages/README.md", title: "packages/README.md" },
		inboxCount: 1,
	});
});

boardStory.it("the reading shell for a nested file carries no folder tree, which loads on its own", project, function* ({ shellFolderTree }) {
	expect(yield* shellFolderTree("/packages/form/README.md")).toBe("no folder tree");
});

boardStory.it("the library hides Fleet records unless asked and counts the hidden ones", project, function* ({ fleetOnlyFiles, hiddenFleetRecords }) {
	yield* outcomes([
		["files shown only with Fleet records", () => fleetOnlyFiles(), ["responses/decision.md"]],
		["the hidden count", () => hiddenFleetRecords(), 1],
	]);
});
