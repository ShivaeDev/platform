import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";
import { closedInboxAsks, savedLast } from "#test/attentionLaneTraits.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it(
	"Needs you keeps the authored question and only the newest Fleet ask for open work, counting the older one",
	[closedInboxAsks()],
	function* ({ inboxAsk, inboxLane }) {
		yield* outcomes([
			[
				"draft task's ask",
				() => inboxAsk("task.draft"),
				{ earlierAsks: 1, href: "/_board/item/decision.draft.2/#answer-card-approval", reason: "Fleet asks: draft ask 2" },
			],
			["needs you", () => inboxLane("you"), ["question.storage", "task.draft"]],
		]);
	},
);

boardStory.it(
	"Fleet asks for finished work are resolved and asks for deferred work are parked",
	[closedInboxAsks()],
	function* ({ inboxLaneSources }) {
		yield* outcomes([
			["parked", () => inboxLaneSources("parked"), ["asks/deferred-1.md"]],
			["resolved", () => inboxLaneSources("resolved"), ["asks/done-1.md", "asks/done-2.md", "asks/done-3.md", "asks/dropped-1.md"]],
		]);
	},
);

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`a Fleet ask resolves when every target is closed, one of them ${status} and one named by a criterion`,
		[
			closedInboxAsks((files) => {
				files["done.md"] = `---\nid: task.done\nstatus: ${status}\ncriteria:\n  - id: proof\n    text: Evidence\n---\n# Finished work\n`;
				files["asks/done-1.md"] = files["asks/done-1.md"]?.replace("[task.done]", "[task.done#proof, task.dropped]") ?? "";
			}),
		],
		function* ({ inboxLaneSources }) {
			expect(yield* inboxLaneSources("resolved")).toEqual(["asks/done-1.md", "asks/done-2.md", "asks/done-3.md", "asks/dropped-1.md"]);
		},
	);
}

boardStory.it(
	"Fleet asks targeting both finished and deferred work keep waiting instead of resolving or parking, the newer counting the older",
	[
		closedInboxAsks((files) => {
			files["asks/done-1.md"] = files["asks/done-1.md"]?.replace("[task.done]", "[task.done, task.deferred]") ?? "";
			files["asks/deferred-1.md"] = files["asks/deferred-1.md"]?.replace("[task.deferred]", "[task.deferred, task.done]") ?? "";
		}),
	],
	function* ({ inboxAsk, inboxLaneSources }) {
		yield* outcomes([
			["mixed ask", () => inboxAsk("decision.deferred.1"), expect.objectContaining({ earlierAsks: 1 })],
			["needs you", () => inboxLaneSources("you"), ["question.md", "asks/draft-2.md", "asks/deferred-1.md"]],
			["parked", () => inboxLaneSources("parked"), []],
			["resolved", () => inboxLaneSources("resolved"), ["asks/done-2.md", "asks/done-3.md", "asks/dropped-1.md"]],
		]);
	},
);

boardStory.it(
	"the most recently saved Fleet ask for a task leads Needs you even when its file sorts first",
	[closedInboxAsks(), savedLast("asks/draft-1.md")],
	function* ({ inboxAsk }) {
		expect(yield* inboxAsk("task.draft")).toMatchObject({ earlierAsks: 1, reason: "Fleet asks: draft ask 1" });
	},
);

boardStory.it(
	"two requests in one Fleet source for the same task, one through a criterion, count as one ask with an earlier ask",
	[
		closedInboxAsks((files) => {
			delete files["asks/draft-2.md"];
			files["draft.md"] = files["draft.md"]?.replace("owner: codex", "owner: codex\ncriteria:\n  - id: proof\n    text: Evidence") ?? "";
			files["asks/draft-1.md"] =
				files["asks/draft-1.md"]?.replace(
					"    unblocks: [task.draft]",
					"    unblocks: [task.draft#proof]\n  - id: later\n    kind: decision\n    managed: true\n    state: open\n    reason: Later request in the same source\n    response_from: [maintainer]\n    unblocks: [task.draft]",
				) ?? "";
		}),
	],
	function* ({ inboxAsk, inboxLane }) {
		yield* outcomes([
			[
				"draft task's ask",
				() => inboxAsk("task.draft"),
				{ earlierAsks: 1, href: "/_board/item/decision.draft.1/#answer-card-later", reason: "Fleet asks: Later request in the same source" },
			],
			["needs you", () => inboxLane("you"), ["question.storage", "task.draft"]],
		]);
	},
);

boardStory.it(
	"a registered ask on an ordinary source joins the other asks for its task under its own reason",
	[
		closedInboxAsks((files) => {
			const source = files["asks/draft-2.md"]?.replace("managed: true", "managed: false") ?? "";
			const reviewedRevision = revisionOf(source);
			files["asks/draft-2.md"] = source;
			files["responses/draft.md"] = questionMarkdown({
				context: source,
				id: questionId("decision.draft.2", "approval", reviewedRevision, "asks/draft-2.md"),
				question: {
					deadline: 200,
					item: "decision.draft.2",
					reason: "draft ask 2",
					registeredAt: 100,
					request: "approval",
					reviewedRevision,
					source: "asks/draft-2.md",
				},
			});
		}),
	],
	function* ({ inboxAsk, inboxLane }) {
		yield* outcomes([
			["draft task's ask", () => inboxAsk("task.draft"), expect.objectContaining({ earlierAsks: 1, reason: "draft ask 2" })],
			["needs you", () => inboxLane("you"), ["question.storage", "task.draft"]],
		]);
	},
);
