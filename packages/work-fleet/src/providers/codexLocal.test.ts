import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { requestCursor } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";

const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
providerStory.it(
	"uses acknowledged IDs and caches terminal evidence; closing an observer never interrupts",
	[],
	function* ({ provider, replyWith, closeObserver }) {
		const methods: string[] = [];
		yield* replyWith((request) => {
			methods.push(request.method);
			if (request.method === "thread/start") {
				return { thread: { id: receipt.sessionId } };
			}
			if (request.method === "turn/start") {
				return { turn: { id: receipt.turnId } };
			}
			if (request.method === "thread/turns/list") {
				return { data: [{ id: receipt.turnId, items: [], status: "completed" }], nextCursor: null };
			}
			if (request.method === "thread/items/list") {
				return { data: [{ item: { id: "message", text: "Evidence", type: "agentMessage" } }], nextCursor: null };
			}
			return {};
		});
		yield* Effect.gen(function* () {
			const sessionId = yield* provider.startSession({ cwd: "/synthetic", operationId: "operation", prompt: "work" });
			expect(sessionId).toBe(receipt.sessionId);
			expect(yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId })).toEqual(receipt);
			expect((yield* provider.observe(receipt)).output).toBe("Evidence");
			yield* provider.observe(receipt);
		});
		yield* closeObserver();
		expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(1);
		expect(methods.filter((method) => method === "thread/items/list")).toHaveLength(1);
		expect(methods).not.toContain("thread/resume");
		expect(methods).not.toContain("turn/interrupt");
	},
);
providerStory.it("reconciles across all pages and refuses ambiguous duplicate operations", [], function* ({ provider, replyWith }) {
	const methods: string[] = [];
	yield* replyWith((request) => {
		methods.push(request.method);
		if (request.method !== "thread/turns/list") {
			return {};
		}
		const cursor = requestCursor(request);
		return {
			data: [
				{
					id: cursor === "second" ? "second-turn" : "first-turn",
					items: [{ clientId: "operation", id: "input", type: "userMessage" }],
					status: "completed",
				},
			],
			nextCursor: cursor === "second" ? null : "second",
		};
	});
	const result = yield* Effect.gen(function* () {
		return yield* provider.reconcile({ operationId: "operation", sessionId: receipt.sessionId }).pipe(Effect.flip);
	});
	expect(result.reason).toBe("ambiguous");
	expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(2);
	expect(methods).not.toContain("turn/start");
});
providerStory.it(
	"adopts an existing acknowledged turn after restart and requires explicit interrupt acknowledgement",
	[],
	function* ({ provider, replyWith }) {
		const methods: string[] = [];
		yield* replyWith((request) => {
			methods.push(request.method);
			if (request.method === "thread/turns/list") {
				return { data: [{ id: receipt.turnId, items: [], status: "inProgress" }], nextCursor: null };
			}
			if (request.method === "thread/items/list") {
				return { data: [], nextCursor: null };
			}
			return {};
		});
		yield* Effect.gen(function* () {
			expect(yield* provider.reconcile({ operationId: "operation", ...receipt })).toEqual(receipt);
			expect((yield* provider.observe(receipt)).execution).toBe("running");
			expect(yield* provider.interrupt(receipt)).toEqual(receipt);
		});
		expect(methods).not.toContain("turn/start");
		expect(methods.filter((method) => method === "turn/interrupt")).toHaveLength(1);
	},
);
providerStory.it("retains a lost turn response and reconciles its operation without a second submission", [], function* ({ provider, replyWith }) {
	const methods: string[] = [];
	yield* replyWith((request) => {
		methods.push(request.method);
		if (request.method === "thread/start") {
			return { thread: { id: receipt.sessionId } };
		}
		if (request.method === "turn/start") {
			return undefined;
		}
		if (request.method === "thread/turns/list") {
			return {
				data: [{ id: receipt.turnId, items: [{ clientId: "operation", id: "input", type: "userMessage" }], status: "inProgress" }],
				nextCursor: null,
			};
		}
		return {};
	});
	yield* Effect.gen(function* () {
		const sessionId = yield* provider.startSession({ cwd: "/synthetic", operationId: "operation", prompt: "work" });
		expect((yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId }).pipe(Effect.flip)).reason).toBe("ambiguous");
		expect(yield* provider.reconcile({ operationId: "operation", sessionId })).toEqual(receipt);
	});
	expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
});
