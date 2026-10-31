import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { sharedVocabularyFixture } from "#test/sharedVocabularyFixture.ts";

const vocabulary = projectFiles(sharedVocabularyFixture);

boardStory.it(
	"a goal counts tasks by their authored states and shows each implementing lane's own progress",
	[vocabulary],
	function* ({ goalCounts }) {
		expect(yield* goalCounts("goal")).toMatchObject({
			counts: { blocked: 0, done: 1, parked: 2, running: 0, scheduled: 1 },
			lanes: [
				{ counts: { blocked: 0, done: 1, parked: 1, running: 0, scheduled: 1 }, id: "lane.board", title: "Board lane" },
				{ counts: { blocked: 0, done: 0, parked: 1, running: 0, scheduled: 0 }, id: "lane.fleet", title: "Fleet lane" },
			],
		});
	},
);

for (const [id, approved, metadata] of [
	["task.draft", false, { fleet: "manual", owner: "claude", status: "draft" }],
	["task.ready", true, { delivers: "pr", owner: "codex", status: "ready" }],
	["task.done", false, { delivers: "report", fleet: "held", status: "done" }],
] as const) {
	boardStory.it(
		`Work shows ${id} with its shared vocabulary and ${approved ? "approved" : "not approved"} for Fleet`,
		[vocabulary],
		function* ({ workItem }) {
			expect(yield* workItem(id)).toMatchObject({ fleetApproved: approved, metadata });
		},
	);
}

boardStory.it("the library offers each kind of the shared vocabulary as a filter", [vocabulary], function* ({ libraryKinds }) {
	expect(yield* libraryKinds()).toEqual(["goal", "question", "report", "task"]);
});

boardStory.it("blocking questions come before questions that can wait", [vocabulary, responsesEnabled()], function* ({ inboxQuestions }) {
	expect(yield* inboxQuestions()).toEqual(["question.z: blocking task", "question.a: whenever area"]);
});

boardStory.it("a task shows the standing ruling that applies to it", [vocabulary], function* ({ itemRulings }) {
	expect(yield* itemRulings("/ready.md")).toEqual([
		{ answer: "# Engine ruling\n\nUse the existing engine.\n", href: "/ruling.md", title: "Engine ruling" },
	]);
});

boardStory.it(
	"a recorded answer shows on its question and its answer file stays out of the library",
	[vocabulary, responsesEnabled()],
	function* ({ fleetLibraryPaths, itemResponseBodies, maintainerAnswers }) {
		expect(yield* itemResponseBodies("/blocking.md")).toEqual([]);

		yield* maintainerAnswers("question.z", "Keep the engine");

		yield* outcomes({
			library: [fleetLibraryPaths(), expect.not.arrayContaining([expect.stringMatching(/answer\.question\.z\.md$/u)])],
			responses: [itemResponseBodies("/blocking.md"), ["Keep the engine"]],
		});
	},
);
