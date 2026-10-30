import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { answerCardFixture, decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { ACTIVE_GUIDE, closedDecision, GOALS, unansweredDecision } from "#test/itemHeaderFixture.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const HEADER = ".item-summary";
const CHIP = ".item-summary [data-status-token]";
for (const [name, files, token, label] of [
	["an unanswered linked decision", { ...answerCardFixture, "guide.md": ACTIVE_GUIDE }, "needs-you", "Needs you"],
	["an answered linked decision", { ...answeredDecisionFixture(), "guide.md": ACTIVE_GUIDE }, "waiting-on-agents", "Waiting on automation"],
] as const) {
	screenStory.it(
		`shows an active task's request state in its header while ${name} is open`,
		[routedScreen(files, "/_board/item/task.guide/", { home: "home.md" })],
		function* ({ findElement, readAttribute, readText }) {
			yield* eventually(() => expect(findElement(".answer-cards")).not.toBeNull());
			expect(readAttribute(CHIP, "data-status-token")).toBe(token);
			expect(readText(CHIP)).toBe(label);
		},
	);
}

const answeredQuestion = questionId(decisionId, "direction", revisionOf(readyDecisionFixture[decisionFile] ?? ""), decisionFile);
for (const [name, files, item, label] of [
	["a closed decision with a recorded answer", closedDecision(answeredDecisionFixture()), decisionId, "Answered"],
	["the question receipt of that answer", closedDecision(answeredDecisionFixture()), answeredQuestion, "Answered"],
	["a closed decision without an answer", closedDecision(readyDecisionFixture), decisionId, "Closed"],
] as const) {
	screenStory.it(
		`tells whether ${name} was answered once no request is open`,
		[routedScreen(files, `/_board/item/${item}/`, { home: "home.md" })],
		function* ({ findElement, readText }) {
			yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
			expect(findElement(".answer-cards")).toBeNull();
			expect(readText(CHIP)).toBe(label);
		},
	);
}

screenStory.it(
	"shows no outcome for a question receipt while its decision still waits",
	[routedScreen(unansweredDecision(), `/_board/item/${answeredQuestion}/`, { home: "home.md" })],
	function* ({ findElement }) {
		yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
		expect(findElement(CHIP)).toBeNull();
	},
);

screenStory.it(
	"shows when the item last changed after its ID",
	[routedScreen({ "task.md": "---\nid: task.fresh\nkind: task\nstatus: ready\n---\n# Fresh task\n" }, "/_board/item/task.fresh/")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
		const updated = findElement(`${HEADER} [data-item-updated]`);
		expect(updated?.textContent).toMatch(/^updated \S/u);
		expect(findElement("time[data-modified]", updated)).not.toBeNull();
		expect(updated?.previousElementSibling?.textContent).toBe("task.fresh");
		expect(readText(`${HEADER} [role="status"]`)).toBe("");
	},
);

screenStory.it(
	"announces a status change from the file without announcing the first load",
	[
		routedScreen({ "home.md": "# Home", "task.md": "---\nid: task.live\nkind: task\nstatus: draft\n---\n# Live task\n" }, "/_board/item/task.live/", {
			home: "home.md",
		}),
	],
	function* ({ editFile, findElement, readText, refreshDocument }) {
		yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
		const line = findElement(`${HEADER} [role="status"]`);
		expect(line?.textContent).toBe("");
		editFile("task.md", "---\nid: task.live\nkind: task\nstatus: ready\n---\n# Live task\n");
		yield* Effect.promise(() => refreshDocument("/_board/item/task.live/"));
		yield* eventually(() => expect(readText(CHIP)).toBe("Ready"));
		expect(findElement(`${HEADER} [role="status"]`)).toBe(line);
		expect(line?.textContent).toBe("Status changed: Draft → Ready");
	},
);

screenStory.it(
	"links the goal an item implements and offers a handoff for open work",
	[routedScreen(GOALS, "/_board/item/task.part/", { home: "home.md" })],
	function* ({ findElement, findElements, readAttribute }) {
		yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
		const parts = [...findElements(`${HEADER} a`)].filter((link) => link.textContent?.startsWith("Part of"));
		expect(parts.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([["Part of Readable workspace", "/_board/item/goal.reader/"]]);
		expect(readAttribute('a[href^="/_board/handoff"]', "href")).toBe("/_board/handoff?item=task.part");
	},
);

for (const [item, kind] of [
	["task.finished", "Task"],
	["task.dropped", "Task"],
	["goal.reader", "Goal"],
] as const) {
	screenStory.it(
		`offers no agent handoff on ${item}`,
		[routedScreen(GOALS, `/_board/item/${item}/`, { home: "home.md" })],
		function* ({ findElement, readText }) {
			yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
			expect(findElement("#favorite-toggle")).not.toBeNull();
			expect(findElement('a[href^="/_board/handoff"]')).toBeNull();
			expect(readText(`${HEADER} > div > span`)).toBe(kind);
		},
	);
}

const PR = "https://github.com/example/project/pull/7";
const reviewing: FleetItemsProjection = {
	completed: [],
	items: [{ document: null, prUrl: PR, stage: "reviewing", stageEnteredAt: 0, updatedAt: 0, workId: "task.part" }],
	state: "ready",
};

screenStory.it(
	"gives header controls a 44px target on coarse pointers",
	[
		screenFleet(reviewing),
		routedScreen({ ...GOALS, "task.md": `${GOALS["task.md"]}\n\n## First\n\nText.\n\n## Second\n\nText.\n` }, "/_board/item/task.part/", {
			home: "home.md",
		}),
	],
	function* ({ findElement, findElements }) {
		yield* eventually(() => expect(findElement(`${HEADER} a[href="${PR}"]`)).not.toBeNull());
		const controls = {
			copy: findElement(`${HEADER} button[aria-label="Copy item ID"]`),
			goal: [...findElements(`${HEADER} a`)].find((link) => link.textContent?.startsWith("Part of")),
			handoff: findElement('a[href^="/_board/handoff"]'),
			id: findElement(`${HEADER} a[href="/_board/item/task.part/"]`),
			outline: findElement("[data-outline-menu]"),
			pin: findElement("#favorite-toggle"),
			pr: findElement(`${HEADER} a[href="${PR}"]`),
		};
		const large = Object.values(controls).map((control) =>
			[...(control?.classList ?? [])].some((name) => /^pointer-coarse:(?:min-h|h|size)-11$/u.test(name)),
		);
		expect(large).toEqual(Object.values(controls).map(() => true));
	},
);

for (const [clipboard, copied] of [
	["allows the copy", "Copied item ID"],
	["refuses the copy", "Copy failed; select the ID instead"],
] as const) {
	screenStory.it(
		`tells the reader the ID copy result until they move on when the clipboard ${clipboard}`,
		[...(clipboard === "refuses the copy" ? [deniedClipboard()] : []), routedScreen(GOALS, "/_board/item/task.part/", { home: "home.md" })],
		function* ({ click, findElement, focus, readAttribute }) {
			yield* eventually(() => expect(findElement(HEADER)).not.toBeNull());
			const copy = `${HEADER} button[aria-label]`;
			focus(copy);
			click(copy);
			yield* eventually(() => expect(readAttribute(copy, "aria-label")).toBe(copied));
			focus("#favorite-toggle");
			expect(readAttribute(copy, "aria-label")).toBe("Copy item ID");
		},
	);
}
