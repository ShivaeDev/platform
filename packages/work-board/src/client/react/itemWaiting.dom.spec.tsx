import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { answerCardFixture, TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const HEADER = ".item-summary";
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
	"leads an item with the open asks that name it, in amber only when they wait on you",
	[routedScreen(FILES, TASK, { home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("[data-waiting-on]")).not.toBeNull());
		const rows = [...findElements(`${HEADER} [data-waiting-on]`)];
		expect(rows.map((row) => [row.getAttribute("data-waiting-on"), row.textContent])).toEqual([
			["you", "Waiting on you: Your pooling designAnswer"],
			["agents", "Waiting on automation: Pool size review"],
		]);
		const [you, agents] = rows;
		expect(you?.className).toContain("bg-needs-you/10");
		expect(agents?.className).not.toContain("needs-you");
		expect(you?.querySelector('a[aria-label="Answer Your pooling design"]')?.getAttribute("href")).toBe(
			"/_board/item/question.pool/#answer-card-answer",
		);
		expect([...(agents?.querySelectorAll("a") ?? [])].map((link) => link.getAttribute("href"))).toEqual(["/_board/item/decision.size/"]);
		expect(readText(HEADER)).not.toContain("Another question");
	},
);

screenStory.it(
	"shows no waiting row once the asks that named the item are closed",
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
	function* ({ findElement }) {
		yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
		expect(findElement("[data-waiting-on]")).toBeNull();
	},
);

screenStory.it(
	"names the items and files a next action mentions, with their status, and leaves unknown words plain",
	[routedScreen(FILES, TASK, { home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("[data-mention]")).not.toBeNull());
		const mentions = [...findElements(`${HEADER} [data-mention]`)].map((mention) => [
			mention.getAttribute("data-mention"),
			mention.querySelector("a")?.textContent,
			mention.querySelector("a")?.getAttribute("href"),
			mention.querySelector("[data-status-token]")?.textContent ?? null,
		]);
		expect(mentions).toEqual([
			["question.pool", "Your pooling design", "/_board/item/question.pool/", "Ready"],
			["goal.old", "Finished goal", "/_board/item/goal.old/", "Done"],
			["notes/plan.md", "The pooling plan", "/notes/plan.md", null],
		]);
		expect(readText(HEADER)).toContain("and task.missing. Merge #828 and PR 12.");
		expect(findElement(`${HEADER} a[href*="/pull/"]`)).toBeNull();
	},
);

screenStory.it(
	"links pull request numbers to the workspace repository without Fleet",
	[routedScreen(FILES, TASK, { home: "home.md", pullRequests: "https://github.com/example/project/pull/" })],
	function* ({ findElement, findElements }) {
		yield* eventually(() => expect(findElement(`${HEADER} a[href*="/pull/"]`)).not.toBeNull());
		expect([...findElements(`${HEADER} a[href*="/pull/"]`)].map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
			["#828", "https://github.com/example/project/pull/828"],
			["PR 12", "https://github.com/example/project/pull/12"],
		]);
	},
);

screenStory.it(
	"offers a phone-only Answer control at the top of a question that puts focus in the answer box",
	[
		screenWorkspace("answer-jump"),
		routedScreen({ ...textQuestionFixture }, `/_board/item/${TEXT_QUESTION_ID}/`, { home: "home.md", writable: true }),
	],
	function* ({ click, findElement, readFocus }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		const jump = findElement(`${HEADER} [data-answer-jump]`);
		expect(jump?.textContent).toBe("Answer");
		expect(jump?.classList.contains("md:hidden")).toBe(true);
		click(`${HEADER} [data-answer-jump]`);
		yield* eventually(() => expect(readFocus()).toBe(findElement('#response-form [name="body"]')));
	},
);

screenStory.it(
	"keeps the Answer control off a task whose answer card already leads the page",
	[routedScreen(answerCardFixture, "/_board/item/task.guide/", { home: "home.md", writable: true })],
	function* ({ findElement }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		expect(findElement("[data-answer-jump]")).toBeNull();
	},
);
