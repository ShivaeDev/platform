import { describe, expect, it } from "vitest";
import { answersTo, type Board, documentAt, item, needsYou, overview, query } from "#boardTools.ts";
import type { RpcRequest } from "#rpc.ts";

const NOW = 1_800_000_000_000;

function boardAnswering(answers: Readonly<Record<string, unknown>>): Board {
	return {
		ask: (requests: readonly RpcRequest[]) =>
			Promise.resolve(requests.map((request) => answers[request.tag === "work-board.document" ? JSON.stringify(request.payload) : request.tag])),
		now: NOW,
	};
}

function taskAt(stage: string, inbox: unknown) {
	return item(
		boardAnswering({
			[JSON.stringify(documentAt("/_board/item/task.a/").payload)]: {
				metadata: { criteria: [{ id: "proof" }], owner: "codex", status: "draft" },
				requests: [{ id: "r", open: true }],
			},
			"work-board.fleetItems": { completed: [], items: [{ stage, workId: "task.a" }], state: "ready" },
			"work-board.inbox": inbox,
		}),
		"task.a",
	);
}

function exit(id: string, value: unknown): string {
	return JSON.stringify({ _tag: "Exit", exit: { _tag: "Success", value }, requestId: id });
}

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

describe("the read-only tool answers", () => {
	it("board_overview names each Needs you item and sums goal progress", async () => {
		const board = boardAnswering({
			"work-board.fleetItems": { reason: "Fleet is not configured", state: "unavailable" },
			"work-board.goals": { goals: [{ counts: { done: 1, draft: 3 }, id: "goal.a", title: "Goal A" }] },
			"work-board.inbox": INBOX,
		});
		expect(await overview(board)).toEqual({
			fleet: { reason: "Fleet is not configured", state: "unavailable" },
			goals: { done: 1, goals: [{ done: 1, id: "goal.a", ready: 0, title: "Goal A", total: 4 }], total: 4 },
			needsYou: { complete: true, count: 1, you: [{ id: "decision.a", reason: "Pick one", title: "Decide" }] },
		});
	});

	it("needs_you adds the open request's options, prompts and recommendation and the item's age", async () => {
		const board = boardAnswering({
			[JSON.stringify(documentAt("/decide.md").payload)]: {
				metadata: { id: "decision.a", options: [{ label: "Fallback" }] },
				requests: [{ id: "next", options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" }],
			},
			"work-board.inbox": INBOX,
		});
		expect((await needsYou(board)).you).toEqual([
			expect.objectContaining({ ageMs: 5000, id: "decision.a", options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" }),
		]);
	});

	it("item keeps authored status separate from the Fleet stage", async () => {
		expect(await taskAt("waiting", { you: [] })).toMatchObject({
			criteria: [{ id: "proof" }],
			openDecisions: [{ id: "r" }],
			owner: "codex",
			status: "draft",
		});
		expect(await taskAt("done", { you: [] })).toMatchObject({ fleet: { item: { stage: "done" } }, status: "draft" });
		expect(await taskAt("released", { you: [{ id: "task.a", reason: "Waiting" }] })).toMatchObject({ fleet: { item: null }, status: "draft" });
		expect(await taskAt("released", { you: [] })).toMatchObject({ status: "draft" });
	});

	it("matches answers to requests and names what the Board could not read", () => {
		const missing = JSON.stringify({ _tag: "Exit", exit: { _tag: "Failure", cause: [{ error: { message: "No such item." } }] }, requestId: "2" });
		const requests = [query("inbox"), documentAt("/_board/item/task%20b/")];
		expect(answersTo([query("inbox")], exit("1", "ok"), "/repo")).toEqual(["ok"]);
		expect(() => answersTo(requests, `${exit("1", "ok")}\n${missing}`, "/repo")).toThrow(
			"The Work Board for /repo could not read item task b: No such item.",
		);
		expect(() => answersTo(requests, exit("1", "ok"), "/repo")).toThrow("The Work Board for /repo sent no answer for work-board.document.");
		expect(() => answersTo(requests, "", "/repo")).toThrow("The Work Board for /repo did not answer with its RPC stream.");
	});
});
