import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerCardFixture, TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const NEXT = "Waiting on question.pool. Then close goal.old, see notes/plan.md and task.missing. Merge #828 and PR 12.";
const FILES = {
	"agents.md": `---
id: decision.size
kind: question
scope: task
urgency: whenever
attention:
  - id: review
    kind: decision
    reason: Pick a pool size
    response_from: [agent]
    state: open
    unblocks: [task.pool]
---
# Pool size review
`,
	"goal.md": "---\nid: goal.old\nkind: goal\nstatus: done\n---\n# Finished goal\n",
	"home.md": "# Home",
	"notes/plan.md": "# The pooling plan\n",
	"other.md":
		"---\nid: question.other\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\nrelationships:\n  - kind: relates_to\n    target: goal.old\n---\n# Another question\n",
	"question.md":
		"---\nid: question.pool\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\nrelationships:\n  - kind: relates_to\n    target: task.pool\n---\n# Your pooling design\n\nHow should the tests share connections?\n",
	"task.md": `---\nid: task.pool\nkind: task\nstatus: draft\nnext_action: "${NEXT}"\n---\n# Pool the scale tests\n`,
};
const TASK = "/_board/item/task.pool/";

screenStory.it(
	"an item's header leads with the open asks that name it, highlighting only the one that waits on you and linking it straight to its answer card",
	[routedScreen(FILES, TASK, { home: "home.md" })],
	function* ({ waitingRows }) {
		expect(yield* waitingRows()).toEqual([
			{
				highlighted: true,
				links: ["Your pooling design -> /_board/item/question.pool/", "Answer Your pooling design -> /_board/item/question.pool/#answer-card-answer"],
				text: "Waiting on you: Your pooling designAnswer",
			},
			{ highlighted: false, links: ["Pool size review -> /_board/item/decision.size/"], text: "Waiting on automation: Pool size review" },
		]);
	},
);

screenStory.it(
	"an ask that only relates to another item stays out of this item's header",
	[routedScreen(FILES, TASK, { home: "home.md" })],
	function* ({ itemHeaderText }) {
		expect(yield* itemHeaderText()).not.toContain("Another question");
	},
);

screenStory.it(
	"once the asks that named an item are closed, its header shows nothing waiting",
	[
		routedScreen(
			{
				...FILES,
				"agents.md": FILES["agents.md"].replace("state: open", "state: closed"),
				"question.md": FILES["question.md"].replace("status: ready", "status: done"),
			},
			TASK,
			{ home: "home.md" },
		),
	],
	function* ({ waitingRows }) {
		expect(yield* waitingRows()).toEqual([]);
	},
);

screenStory.it(
	"a next action names the items and files it mentions by title, with their status, and leaves unknown IDs and PR numbers plain without a repository",
	[routedScreen(FILES, TASK, { home: "home.md" })],
	function* ({ itemHeaderText, nextActionMentions, nextActionPullRequests }) {
		yield* outcomes({
			mentions: [
				nextActionMentions(),
				[
					"Your pooling design -> /_board/item/question.pool/ (Ready)",
					"Finished goal -> /_board/item/goal.old/ (Done)",
					"The pooling plan -> /notes/plan.md",
				],
			],
			"plain words": [itemHeaderText(), expect.stringContaining("and task.missing. Merge #828 and PR 12.")],
			"pull requests": [nextActionPullRequests(), []],
		});
	},
);

screenStory.it(
	"with a workspace repository, a next action links its pull request numbers there, without Fleet",
	[routedScreen(FILES, TASK, { home: "home.md", pullRequests: "https://github.com/example/project/pull/" })],
	function* ({ nextActionPullRequests }) {
		expect(yield* nextActionPullRequests()).toEqual([
			"#828 -> https://github.com/example/project/pull/828",
			"PR 12 -> https://github.com/example/project/pull/12",
		]);
	},
);

screenStory.it(
	"pressing Answer at the top of a question puts keyboard focus in its answer box",
	[routedScreen({ ...textQuestionFixture }, `/_board/item/${TEXT_QUESTION_ID}/`, { home: "home.md", writable: true })],
	function* ({ answerBoxState, answerJump, pressAnswerJump }) {
		yield* outcomes({
			"Answer control": [answerJump(), "Answer"],
			"answer box": [answerBoxState(), expect.objectContaining({ focused: false })],
		});

		yield* pressAnswerJump();

		expect(yield* answerBoxState()).toEqual(expect.objectContaining({ focused: true }));
	},
);

screenStory.it(
	"a task whose answer card already leads the page has no Answer control in its header",
	[routedScreen(answerCardFixture, "/_board/item/task.guide/", { home: "home.md", writable: true })],
	function* ({ answerJump, cardTitle }) {
		yield* outcomes({
			"Answer control": [answerJump(), "none"],
			"answer card": [cardTitle(), "Answer: Publish the install guide"],
		});
	},
);
