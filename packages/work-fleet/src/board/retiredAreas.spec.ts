import { Effect } from "effect";
import { expect } from "vitest";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

boardFolderStory.it(
	"Fleet keeps historical briefs readable without area warnings while runnable briefs still report removed folders",
	[folderContains("retiredAreas")],
	function* (story) {
		const historical = ["done", "dropped", "ready"];
		for (const id of historical) {
			expect(yield* story.readBrief(id)).toMatchObject({ status: id, workId: id });
		}
		expect(story.recordedBoardLogs()).toEqual([]);
		story.files.write("open.md", "---\nid: open\nkind: task\nstatus: ready\nareas: [removed-package]\n---\n# Runnable work\n");
		expect(yield* story.readBrief("open").pipe(Effect.flip)).toMatchObject({
			_tag: "BoardFailure",
			message: expect.stringContaining("removed-package"),
		});
		expect(JSON.stringify(story.recordedBoardLogs())).toContain("open.md");
	},
);
