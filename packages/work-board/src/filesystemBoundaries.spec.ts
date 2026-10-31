import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { directoryNotificationsDelivered, fileReadsCounted } from "#test/servingStoryTraits.ts";

const log = projectFiles({ "notes/log.md": "# Before" });

for (const [order, boundaries] of [
	["the read counter wraps the filesystem first", [fileReadsCounted, directoryNotificationsDelivered()]],
	["directory notifications wrap the filesystem first", [directoryNotificationsDelivered(), fileReadsCounted]],
] as const) {
	boardStory.it(
		`when ${order}, both boundaries see a notified edit`,
		[log, ...boundaries],
		function* ({ documentAt, editFile, fileReadCount, notifiedFolders, notifyChange }) {
			expect(yield* documentAt("/notes/log.md")).toBe("# Before");
			const readsBefore = yield* fileReadCount();
			editFile("notes/log.md", "# After");

			yield* notifyChange("notes/log.md");

			yield* outcomes({
				document: [documentAt("/notes/log.md"), "# After"],
				reads: [fileReadCount(), expect.toSatisfy((reads: number) => reads > readsBefore, "more reads than before the edit")],
				watched: [notifiedFolders(), ["the workspace"]],
			});
		},
	);
}

boardStory.it(
	"once the boards stop, a directory notification has no watcher to reach",
	[directoryNotificationsDelivered()],
	function* ({ notificationOutcome, stopBoards }) {
		expect(yield* notificationOutcome("notes")).toBe("delivered");

		yield* stopBoards();

		expect(yield* notificationOutcome("notes")).toBe("refused: No watcher stream is listening for directory notifications");
	},
);
