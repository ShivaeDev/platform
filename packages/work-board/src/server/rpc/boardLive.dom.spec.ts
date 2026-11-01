import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { observedSockets } from "#test/observedSockets.ts";

const project = [
	projectFiles({
		"brief.md":
			"---\nid: task.brief\nkind: task\nstatus: ready\nrelationships:\n - kind: implements\n   target: goal.ship\n---\n# Write the brief\n\nFirst draft.",
		"goal.md": "---\nid: goal.ship\nkind: goal\nstatus: ready\n---\n# Ship the Board",
		"other.md": "# Unrelated document\n\nKeep this reading.",
	}),
	observedSockets,
	readerAt("/brief.md"),
];
const DONE =
	"---\nid: task.brief\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: goal.ship\n---\n# Write the brief\n\nReviewed draft.";

boardStory.it(
	"finishing the task on disk shows in the open page and in the plugin's next read of its goal progress",
	project,
	function* ({ editFile, openPlugin, pageShowing, pluginProgress }) {
		yield* openPlugin();
		expect(yield* pluginProgress()).toBe("0 of 1 done");

		editFile("brief.md", DONE);

		yield* outcomes([
			["the page", () => pageShowing("Reviewed draft."), "showing"],
			["the plugin", () => pluginProgress(), "1 of 1 done"],
		]);
	},
);

boardStory.it(
	"after a disk edit the open page re-reads its document once and its Fleet items, goals and navigation, but not the server or the watcher",
	project,
	function* ({ editFile, pageMarked, pageReadsSinceMark, pageShowing }) {
		pageMarked();

		editFile("brief.md", DONE);
		yield* pageShowing("Reviewed draft.");

		expect(yield* pageReadsSinceMark()).toEqual({
			"work-board.document": 1,
			"work-board.fleetItems": expect.any(Number),
			"work-board.goals": expect.any(Number),
			"work-board.navigation": expect.any(Number),
		});
	},
);

boardStory.it(
	"across a disk edit the page and a following client keep one socket each, and the plugin reads goal progress over none",
	project,
	function* ({ editFile, followDocument, openPlugin, pageShowing, pluginProgress, socketsOpened }) {
		yield* openPlugin();
		yield* followDocument("/other.md");

		editFile("brief.md", DONE);
		yield* pageShowing("Reviewed draft.");

		yield* outcomes([
			["the plugin's goal progress", () => pluginProgress(), "1 of 1 done"],
			["sockets opened", () => socketsOpened(), { "node clients": ["the board's RPC socket"], "the page": ["the board's RPC socket"] }],
		]);
	},
);
