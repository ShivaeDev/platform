import { describe, expect, it } from "vitest";
import { flightsOf, goalsOf, goalTitlesOf } from "#answers.ts";
import { boardInit, readBoard } from "#board.ts";
import { readExits } from "#rpc.ts";

const NOW = 1_800_000_000_000;

function success(requestId: string, value: unknown): string {
	return JSON.stringify({ _tag: "Exit", exit: { _tag: "Success", value }, requestId });
}

function failure(requestId: string, error: unknown): string {
	return JSON.stringify({ _tag: "Exit", exit: { _tag: "Failure", cause: [{ _tag: "Fail", error }] }, requestId });
}

function reply(...lines: readonly string[]) {
	return { ok: true, status: 200, text: `${lines.join("\n")}\n` };
}

describe("the Board's RPC stream", () => {
	it("asks for inbox, fleetItems, goals and server in one ndjson request on the .work socket", () => {
		const init = boardInit("/repo");
		expect(init).toMatchObject({ headers: { "content-type": "application/ndjson" }, method: "POST", socketPath: "/repo/.work/board.sock" });
		expect(
			init.body
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line)),
		).toEqual(
			["inbox", "fleetItems", "goals", "server"].map((query, index) => ({
				_tag: "Request",
				headers: [],
				id: String(index + 1),
				payload: null,
				tag: `work-board.${query}`,
			})),
		);
		expect(boardInit("/").socketPath).toBe("/.work/board.sock");
	});

	it("reads each exit by request id and names a failure by its error message or tag", () => {
		const exits = readExits(
			[
				"not json",
				success("2", "two"),
				failure("1", { _tag: "NotFound", message: "The document is missing." }),
				failure("3", {}),
				success("0", "x"),
			].join("\n"),
		);
		expect([...exits.entries()]).toEqual([
			[1, { value: "two" }],
			[0, { failure: "The document is missing." }],
			[2, { failure: "Fail" }],
		]);
	});

	it("reads Needs you with item URLs on the served Board, In flight and Goals", () => {
		const board = readBoard(
			reply(
				success("1", {
					you: [
						{ href: "/_board/item/todo.a/", id: "todo.a", title: "First" },
						{ href: "/_board/item/todo.a/#answer-card-x", id: "todo.a", title: "Second" },
						{ file: "loose.md", href: "https://example.com/elsewhere" },
					],
				}),
				success("2", { items: [], state: "ready" }),
				success("3", { goals: [{ counts: { done: 1, draft: 1 }, id: "goal.a", title: "Goal A" }] }),
				success("4", { directory: "/repo/.work", url: "http://127.0.0.1:4801" }),
			),
			"/repo",
			NOW,
		);
		expect(board).toEqual({
			asks: {
				items: [
					{ key: "open:todo.a", title: "First", url: "http://127.0.0.1:4801/_board/item/todo.a/" },
					{ key: "open:todo.a:1", title: "Second", url: "http://127.0.0.1:4801/_board/item/todo.a/#answer-card-x" },
					{ key: "open:loose.md", title: "loose.md", url: "https://example.com/elsewhere" },
				],
				problem: null,
			},
			flights: { items: [], problem: null },
			goals: { items: [{ done: 1, id: "goal.a", ready: 0, title: "Goal A", total: 2 }], problem: null },
			kind: "ready",
		});
	});

	it("keeps a query's problem in its block and leaves item URLs unknown without a server answer", () => {
		const board = readBoard(reply(success("1", { you: [{ href: "/x/", id: "todo.a" }] }), failure("3", { message: "down" })), "/repo", NOW);
		expect(board).toMatchObject({
			asks: { items: [{ url: null }] },
			flights: { problem: "The Board sent no answer for this query." },
			goals: { problem: "The Board could not answer this query." },
		});
	});

	it("turns a refused request and a stream without exits into an error", () => {
		expect(readBoard({ ok: false, status: 503, text: "busy\n" }, "/repo", NOW)).toEqual({
			kind: "error",
			message: "The Work Board for /repo refused the request (503): busy",
		});
		expect(readBoard(reply("<html>"), "/repo", NOW)).toEqual({
			kind: "error",
			message: "The Work Board for /repo did not answer with its RPC stream.",
		});
	});
});

describe("Fleet items and goals", () => {
	it("keeps working stages, links each item to the goal it implements and times its stage", () => {
		const titles = goalTitlesOf({
			closedGoals: [{ id: "goal.closed", title: "Closed goal" }],
			deferredGoals: [{ id: "goal.parked", title: "Parked goal" }],
			goals: [{ id: "project.open" }],
		});
		expect(titles.get("goal.parked")).toBe("Parked goal");
		const flights = flightsOf(
			{
				items: [
					{
						document: { metadata: { relationships: [{ kind: "implements", target: "goal.closed#part" }] }, title: "Linked" },
						prUrl: "https://github.com/example/repo/pull/7",
						stage: "reviewing",
						stageEnteredAt: NOW - 60_000,
						workId: "task.linked",
					},
					{ document: { metadata: { relationships: [{ kind: "implements", target: "project.x" }] } }, stage: "working", workId: "task.loose" },
					{ stage: "queued", workId: "task.waiting" },
				],
				state: "ready",
			},
			NOW,
			titles,
		);
		expect(flights).toEqual({
			items: [
				{
					goal: { id: "goal.closed", title: "Closed goal" },
					inStageMs: 60_000,
					prUrl: "https://github.com/example/repo/pull/7",
					stage: "reviewing",
					title: "Linked",
					workId: "task.linked",
				},
				{ goal: null, inStageMs: null, prUrl: null, stage: "working", title: "task.loose", workId: "task.loose" },
			],
			problem: null,
		});
	});

	it("says why Fleet has no items", () => {
		expect(flightsOf({ reason: "Fleet is not configured", state: "unavailable" }, NOW).problem).toBe("Fleet is unavailable: Fleet is not configured");
		expect(flightsOf(null, NOW).problem).toBe("Fleet sent no items.");
	});

	it("counts done, ready and total tasks per goal", () => {
		expect(goalsOf({ goals: [{ counts: { deferred: 1, done: 2, draft: 4, dropped: 1, ready: 3 }, id: "goal.a" }] }).items).toEqual([
			{ done: 2, id: "goal.a", ready: 3, title: "goal.a", total: 11 },
		]);
	});

	it("counts parked work in the total and ready work as active", () => {
		expect(goalsOf({ goals: [{ counts: { deferred: 1, done: 2, draft: 4, ready: 3 }, id: "goal.b" }] }).items).toEqual([
			{ done: 2, id: "goal.b", ready: 3, title: "goal.b", total: 10 },
		]);
	});
});
