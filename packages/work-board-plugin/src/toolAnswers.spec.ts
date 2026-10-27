import { expect } from "vitest";
import { documentAt } from "#boardTools.ts";
import { boardAnswers, boardTools, NOW, taskInFleet } from "#test/boardTools.ts";

const INBOX = {
	complete: true,
	issues: [],
	you: [
		{
			file: "decide.md",
			href: "/_board/item/decision.a/#answer-card-next",
			id: "decision.a",
			modified: NOW - 5000,
			reason: "Pick one",
			title: "Decide",
		},
	],
};

boardTools.it(
	"board_overview names each Needs you item and sums goal progress",
	[
		boardAnswers({
			"work-board.fleetItems": { reason: "Fleet is not configured", state: "unavailable" },
			"work-board.goals": { goals: [{ counts: { done: 1, parked: 3 }, id: "goal.a", title: "Goal A" }] },
			"work-board.inbox": INBOX,
		}),
	],
	function* ({ overview }) {
		expect(yield* overview()).toEqual({
			fleet: { reason: "Fleet is not configured", state: "unavailable" },
			goals: {
				done: 1,
				goals: [
					{ achieved: false, blocked: 0, done: 1, id: "goal.a", parked: 3, running: 0, scheduled: 0, standing: false, title: "Goal A", total: 4 },
				],
				total: 4,
			},
			needsYou: { complete: true, count: 1, you: [{ id: "decision.a", reason: "Pick one", title: "Decide" }] },
		});
	},
);

boardTools.it(
	"needs_you adds the open request's options, prompts and recommendation and the item's age",
	[
		boardAnswers({
			[JSON.stringify(documentAt("/decide.md").payload)]: {
				metadata: { id: "decision.a", options: [{ label: "Fallback" }] },
				requests: [{ id: "next", options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" }],
			},
			"work-board.inbox": INBOX,
		}),
	],
	function* ({ needsYou }) {
		expect((yield* needsYou()).you).toEqual([
			expect.objectContaining({ ageMs: 5000, id: "decision.a", options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" }),
		]);
	},
);

for (const stage of ["waiting", "done", "released"]) {
	boardTools.it(`item keeps authored status separate from the ${stage} Fleet stage`, [taskInFleet(stage)], function* ({ item }) {
		expect(yield* item("task.a")).toMatchObject({
			criteria: [{ id: "proof" }],
			fleet: { item: stage === "released" ? null : { stage } },
			openDecisions: [{ id: "r" }],
			owner: "codex",
			status: "draft",
		});
	});
}
