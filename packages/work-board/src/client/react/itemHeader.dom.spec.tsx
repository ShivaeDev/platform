import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { answerCardFixture, decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { ACTIVE_GUIDE, closedDecision, GOALS, liveTask, unansweredDecision } from "#test/itemHeaderFixture.ts";
import { clipboardRecorded, readingPage } from "#test/readingScreenTraits.tsx";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

for (const [name, files, label] of [
	["an unanswered linked decision", { ...answerCardFixture, "guide.md": ACTIVE_GUIDE }, "Needs you"],
	["an answered linked decision", { ...answeredDecisionFixture(), "guide.md": ACTIVE_GUIDE }, "Waiting on automation"],
] as const) {
	screenStory.it(
		`an active task reads ${label} in its header while ${name} is open`,
		[readingPage(files, "/_board/item/task.guide/", { home: "home.md" })],
		function* ({ itemStatus }) {
			expect(yield* itemStatus()).toBe(label);
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
		`${name} reads ${label} and offers no answer card`,
		[readingPage(files, `/_board/item/${item}/`, { home: "home.md" })],
		function* ({ answerCards, itemStatus }) {
			yield* outcomes([
				["answer cards", () => answerCards(), []],
				["status", () => itemStatus(), label],
			]);
		},
	);
}

screenStory.it(
	"a question receipt shows no status while its decision still waits for an answer",
	[readingPage(unansweredDecision(), `/_board/item/${answeredQuestion}/`, { home: "home.md" })],
	function* ({ itemStatus }) {
		expect(yield* itemStatus()).toBe("none");
	},
);

screenStory.it(
	"an item header says when the item last changed, right after its ID",
	[readingPage({ "task.md": "---\nid: task.fresh\nkind: task\nstatus: ready\n---\n# Fresh task\n" }, "/_board/item/task.fresh/")],
	function* ({ itemUpdated }) {
		expect(yield* itemUpdated()).toEqual({ follows: "task.fresh", text: "updated <time>" });
	},
);

screenStory.it(
	"a status change in the file is announced in the header's existing status region, and the first load is not",
	[readingPage({ "home.md": "# Home", "task.md": liveTask("draft") }, "/_board/item/task.live/", { home: "home.md" })],
	function* ({ itemStatus, rewriteDocument, statusAnnouncement }) {
		expect(yield* statusAnnouncement()).toEqual({ region: "original", text: "" });

		yield* rewriteDocument("task.md", liveTask("ready"));

		yield* outcomes([
			["announcement", () => statusAnnouncement(), { region: "original", text: "Status changed: Draft → Ready" }],
			["status", () => itemStatus(), "Ready"],
		]);
	},
);

screenStory.it(
	"an item header links the goal the item implements",
	[readingPage(GOALS, "/_board/item/task.part/", { home: "home.md" })],
	function* ({ itemGoals }) {
		expect(yield* itemGoals()).toEqual([{ href: "/_board/item/goal.reader/", name: "Part of Readable workspace" }]);
	},
);

screenStory.it(
	"an open task offers an agent handoff for itself",
	[readingPage(GOALS, "/_board/item/task.part/", { home: "home.md" })],
	function* ({ itemActions }) {
		expect(yield* itemActions()).toContainEqual({ href: "/_board/handoff?item=task.part", name: "Prepare an agent handoff" });
	},
);

for (const item of ["task.finished", "task.dropped", "goal.reader"]) {
	screenStory.it(
		`${item} offers only Pin and no agent handoff`,
		[readingPage(GOALS, `/_board/item/${item}/`, { home: "home.md" })],
		function* ({ itemActions }) {
			expect(yield* itemActions()).toEqual([{ name: "Pin" }]);
		},
	);
}

screenStory.it(
	"copying the item ID puts the ID on the clipboard",
	[clipboardRecorded(), readingPage(GOALS, "/_board/item/task.part/", { home: "home.md" })],
	function* ({ clipboard, copyItemId }) {
		yield* copyItemId();

		expect(yield* clipboard()).toEqual(["task.part"]);
	},
);

for (const [clipboard, result] of [
	["allows the copy", "Copied item ID"],
	["refuses the copy", "Copy failed; select the ID instead"],
] as const) {
	screenStory.it(
		`copying the item ID says ${JSON.stringify(result)} when the clipboard ${clipboard}`,
		[
			...(clipboard === "refuses the copy" ? [deniedClipboard()] : [clipboardRecorded()]),
			readingPage(GOALS, "/_board/item/task.part/", { home: "home.md" }),
		],
		function* ({ copyButton, copyItemId }) {
			expect(yield* copyButton()).toBe("Copy item ID");

			yield* copyItemId();

			expect(yield* copyButton()).toBe(result);
		},
	);
}

screenStory.it(
	"the copy result goes back to Copy item ID once the reader moves focus away",
	[clipboardRecorded(), readingPage(GOALS, "/_board/item/task.part/", { home: "home.md" })],
	function* ({ copyButton, copyItemId, focusPin }) {
		yield* copyItemId();
		expect(yield* copyButton()).toBe("Copied item ID");

		yield* focusPin();

		expect(yield* copyButton()).toBe("Copy item ID");
	},
);
