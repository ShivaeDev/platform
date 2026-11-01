import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { directoryReadsCanFail, unreadableDirectory } from "#test/incompleteInventory.ts";
import { directoryNotificationsDelivered } from "#test/servingStoryTraits.ts";

const project = projectFiles({
	"hidden/duplicate.md": "---\nid: task.one\nkind: task\nstatus: draft\n---\n# Hidden duplicate",
	"hidden/question.md": inboxQuestion,
	"task.md": "---\nid: task.one\nkind: task\nstatus: draft\n---\n# Visible task",
});

boardStory.it(
	"a hidden duplicate prevents unique identity and a hidden open question keeps membership incomplete until the directory recovers",
	[project, unreadableDirectory("hidden")],
	function* ({ documentFacts, documentRead, inboxQuestions, restoreDirectory, rpc, searchUnavailable }) {
		yield* outcomes([
			["unreadable path", () => searchUnavailable("task"), ["hidden"]],
			["readable source", () => documentRead("/task.md"), { unavailable: ["hidden"] }],
			["unverified identity", () => documentFacts("task.md"), { identity: "none" }],
			["inbox membership", () => rpc((client) => client("work-board.inbox", undefined)), { complete: false, you: [] }],
			[
				"navigation membership",
				() => rpc((client) => client("work-board.navigation", { current: "task.md" })),
				{ counts: { goals: null, library: null, now: null }, inboxCount: null },
			],
			["work membership", () => rpc((client) => client("work-board.work", { url: "/_board/work" })), { items: [], unavailable: ["hidden"] }],
		]);

		yield* restoreDirectory("hidden");

		yield* outcomes([
			["complete scan", () => searchUnavailable("task"), []],
			["duplicate diagnosed", () => documentFacts("task.md"), { identity: "none", problems: [expect.stringContaining("Duplicate ID task.one")] }],
			["inbox membership", () => rpc((client) => client("work-board.inbox", undefined)), { complete: true }],
			["open question", () => inboxQuestions(), [expect.stringContaining("question.storage")]],
		]);
	},
);

for (const directory of ["hidden", "hidden.png", "hidden.md"]) {
	boardStory.it(
		`a read failure in ${directory} with no changed Markdown files invalidates the complete inventory for live readers`,
		[
			projectFiles({ [`${directory}/note.txt`]: "Not indexed", "task.md": "---\nid: task.one\nkind: task\n---\n# Task" }),
			directoryReadsCanFail(directory),
			directoryNotificationsDelivered(),
		],
		function* ({ denyDirectory, listenForChanges, nextAnnouncement, notifyDirectory, searchUnavailable }) {
			expect(yield* searchUnavailable("Task")).toEqual([]);
			yield* listenForChanges();
			yield* denyDirectory(directory);

			yield* notifyDirectory(directory);

			yield* outcomes([
				["live invalidation", () => nextAnnouncement(), "resync"],
				["incomplete inventory", () => searchUnavailable("Task"), [directory]],
			]);
		},
	);
}
