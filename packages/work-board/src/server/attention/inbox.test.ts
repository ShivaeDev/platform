import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { inboxFixture, inboxQuestion } from "#test/inboxFixture.ts";
import { answered, fleetChain, inbox } from "#test/inboxTraits.ts";

boardStory.it(
	"Needs you collects a person's next action, an open authored question and a Fleet request once each",
	[inbox()],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["task.review", "question.storage", "task.fleet"]);
	},
);

boardStory.it("Needs you links an authored question and a Fleet request to their source item's answer card", [inbox()], function* ({ inboxAsk }) {
	yield* outcomes([
		["authored question", () => inboxAsk("question.storage"), expect.objectContaining({ href: "/_board/item/question.storage/#answer-card-answer" })],
		["Fleet request", () => inboxAsk("task.fleet"), expect.objectContaining({ href: "/_board/item/decision.delivery/#answer-card-delivery" })],
	]);
});

boardStory.it(
	"a closed authored question stays out of Needs you",
	[inbox({ "question.md": inboxQuestion.replace("status: ready", "status: done") }, "the storage question is done")],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["task.review", "task.fleet"]);
	},
);

for (const owner of ["claude", "agent-navigation", "Fleet", "bot", "copilot", "orchestrator", "automation"]) {
	boardStory.it(
		`a next action owned by ${owner} stays out of Needs you`,
		[inbox({ "owner.md": `---\nid: task.review\nowner: ${owner}\nnext_action: Continue\n---\n# Work` }, `the review task belongs to ${owner}`)],
		function* ({ inboxLane }) {
			expect(yield* inboxLane("you")).toEqual(["question.storage", "task.fleet"]);
		},
	);
}

boardStory.it(
	"a person's work without a next action stays out of Needs you",
	[inbox({ "owner.md": "---\nid: task.review\nowner: marvin\n---\n# Work" }, "the review task names no next action")],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["question.storage", "task.fleet"]);
	},
);

boardStory.it(
	"a duplicated task identity withholds the Fleet request that unblocks it from Needs you",
	[inbox({ "duplicate.md": inboxFixture()["fleet.md"] ?? "" }, "a second file claims the Fleet task's identity")],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["task.review", "question.storage"]);
	},
);

boardStory.it("a recorded answer to the current authored question takes it out of Needs you", [answered()], function* ({ inboxLane }) {
	expect(yield* inboxLane("you")).toEqual(["task.review", "task.fleet"]);
});

boardStory.it(
	"an authored question whose source changed after its answer waits in Needs you again",
	[answered("answer", `${inboxQuestion}\nNew context`)],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toContain("question.storage");
	},
);

boardStory.it("a clarification request does not answer an authored question", [answered("clarify")], function* ({ inboxLane }) {
	expect(yield* inboxLane("you")).toContain("question.storage");
});

boardStory.it(
	"the library hides a Fleet decision and its registered question and counts them as hidden Fleet records",
	[fleetChain],
	function* ({ hiddenFleetRecords, libraryFiles }) {
		yield* outcomes([
			["hidden Fleet records", () => hiddenFleetRecords(), 2],
			["library", () => libraryFiles(false), ["automation.md", "closed.md", "fleet.md", "owner.md", "question.md"]],
		]);
	},
);

boardStory.it("showing Fleet records lists the Fleet decision and its registered question", [fleetChain], function* ({ libraryFiles }) {
	expect(yield* libraryFiles(true)).toEqual([
		"automation.md",
		"closed.md",
		"fleet.md",
		"responses/decision.md",
		"responses/fleet-question.md",
		"owner.md",
		"question.md",
	]);
});

boardStory.it("the library keeps the registered question of an authored question", [answered()], function* ({ libraryFiles }) {
	expect(yield* libraryFiles(false)).toContain("responses/question.md");
});
