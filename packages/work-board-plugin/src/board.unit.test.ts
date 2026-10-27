import * as HttpStatus from "effect/http/HttpStatus";
import { describe, expect, it } from "vitest";
import { readBoard } from "#board.ts";
import { failure, reply, success } from "#test/rpcReplies.ts";

const NOW = 1_800_000_000_000;

describe("the Board's RPC stream", () => {
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
				success("2", { fleet: { items: [], state: "ready" }, goals: { goals: [{ counts: { done: 1, parked: 1 }, id: "goal.a", title: "Goal A" }] } }),
				success("3", { directory: "/repo/.work", url: "http://127.0.0.1:4801" }),
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
			goals: {
				items: [
					{ achieved: false, blocked: 0, done: 1, id: "goal.a", parked: 1, running: 0, scheduled: 0, standing: false, title: "Goal A", total: 2 },
				],
				problem: null,
			},
			kind: "ready",
		});
	});

	it("keeps a query's problem in its block and leaves item URLs unknown without a server answer", () => {
		const board = readBoard(reply(success("1", { you: [{ href: "/x/", id: "todo.a" }] }), failure("2", { message: "down" })), "/repo", NOW);
		expect(board).toMatchObject({
			asks: { items: [{ url: null }] },
			flights: { problem: "The Board could not answer this query." },
			goals: { problem: "The Board could not answer this query." },
		});
	});

	it("turns a refused request and a stream without exits into an error", () => {
		expect(readBoard({ ok: false, status: HttpStatus.fromLiteral("ServiceUnavailable"), text: "busy\n" }, "/repo", NOW)).toEqual({
			kind: "error",
			message: "The Work Board for /repo refused the request (503): busy",
		});
		expect(readBoard(reply("<html>"), "/repo", NOW)).toEqual({
			kind: "error",
			message: "The Work Board for /repo did not answer with its RPC stream.",
		});
	});
});
