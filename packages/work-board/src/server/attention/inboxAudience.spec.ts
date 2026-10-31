import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { attentionSources, audienceQuestions, responderLabel } from "#test/attentionLaneTraits.ts";
import { boardStory } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";

const fixture = inboxAudienceFixture();
const orchestrator = fixture["orchestrator.md"] ?? "";
const reader = fixture["reader.md"] ?? "";

boardStory.it(
	"Needs you lists the question for the maintainer and the unaddressed question, not the orchestrator's question",
	[audienceQuestions()],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["decision.reader", "question.storage"]);
	},
);

boardStory.it(
	"a question naming the maintainer among several responders waits in Needs you",
	[
		audienceQuestions(
			{ "reader.md": reader.replace("[maintainer]", "[orchestrator, maintainer]") },
			"the reader question asks the orchestrator and the maintainer",
		),
	],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["decision.reader", "question.storage"]);
	},
);

for (const { label, needsYou } of [
	{ label: "maintainer", needsYou: ["question.storage"] },
	{ label: "Casey", needsYou: ["decision.reader", "question.storage"] },
	{ label: "casey", needsYou: ["question.storage"] },
]) {
	boardStory.it(
		`a board answering for ${label} lists a question for Casey in Needs you only when the label matches letter for letter`,
		[attentionSources(inboxAudienceFixture("Casey"), "the reader question asks Casey"), responderLabel(label)],
		function* ({ inboxLane }) {
			expect(yield* inboxLane("you")).toEqual(needsYou);
		},
	);
}

boardStory.it(
	"a duplicated identity on the orchestrator's question keeps it out of Needs you",
	[audienceQuestions({ "duplicate.md": orchestrator }, "a second file copies the orchestrator's question")],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["decision.reader", "question.storage"]);
	},
);

boardStory.it(
	"the orchestrator's question without an identity stays out of Needs you",
	[audienceQuestions({ "orchestrator.md": orchestrator.replace("id: decision.orchestrator\n", "") }, "the orchestrator's question has no identity")],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["decision.reader", "question.storage"]);
	},
);

boardStory.it(
	"a duplicated identity on the maintainer's question reports both files and withholds the question from Needs you",
	[audienceQuestions({ "duplicate.md": reader }, "a second file copies the maintainer's question")],
	function* ({ inboxLane, sourceProblems }) {
		yield* outcomes([
			["needs you", () => inboxLane("you"), ["question.storage"]],
			[
				"source problems",
				() => sourceProblems(),
				expect.arrayContaining([
					{ file: "duplicate.md", message: expect.stringContaining("Duplicate") },
					{ file: "reader.md", message: expect.stringContaining("Duplicate") },
				]),
			],
		]);
	},
);

boardStory.it(
	"an unaddressed question with an empty attention list waits in Needs you",
	[
		attentionSources(
			{ "question.md": (fixture["unaddressed.md"] ?? "").replace("status: ready", "status: ready\nattention: []") },
			"a question lists no attention requests",
		),
	],
	function* ({ inboxLane }) {
		expect(yield* inboxLane("you")).toEqual(["question.storage"]);
	},
);

for (const { fields, change } of [
	{ change: "a next action for claude", fields: "owner: claude\nnext_action: Choose a direction" },
	{ change: "a needs-human status", fields: "status: ready" },
]) {
	boardStory.it(
		`the orchestrator's question with ${change} stays out of Needs you`,
		[
			audienceQuestions(
				{ "orchestrator.md": orchestrator.replace("kind: question\n", `kind: question\n${fields}\n`) },
				`the orchestrator's question carries ${change}`,
			),
		],
		function* ({ inboxLane }) {
			expect(yield* inboxLane("you")).toEqual(["decision.reader", "question.storage"]);
		},
	);
}
