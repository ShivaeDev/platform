import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { refusal } from "#test/refusal.ts";

for (const status of ["done", "dropped", "ready"]) {
	boardFolderStory.it(
		`a ${status} brief in a removed area stays readable without an area warning`,
		[folderContains("retiredAreas")],
		function* ({ readBrief, recordedBoardWarnings }) {
			yield* outcomes([
				["brief", () => readBrief(status), { status, workId: status }],
				["Board warnings", () => recordedBoardWarnings(), []],
			]);
		},
	);
}

boardFolderStory.it(
	"a runnable brief in a removed area is refused and its file is named in the Board warnings",
	[folderContains("retiredAreas")],
	function* ({ files, readBrief, recordedBoardWarnings }) {
		files.write("open.md", "---\nid: open\nkind: task\nstatus: ready\nareas: [removed-package]\n---\n# Runnable work\n");

		const read = yield* refusal(readBrief("open"));

		expect(read).toMatch(/^Board failure: .*removed-package/u);
		expect((yield* recordedBoardWarnings()).join("\n")).toContain("open.md");
	},
);
