import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";

for (const message of ["turn already active for thread", "Another operation owns this thread."]) {
	providerStory.it(
		`an active-turn rejection preserves submission across busy races independently of wording: ${message}`,
		[],
		function* ({ provider, replyWith }) {
			const submissions: unknown[] = [];
			const methods: string[] = [];
			let polls = 0;
			yield* replyWith((request) => {
				methods.push(request.method);
				if (request.method === "turn/start") {
					submissions.push(request.params);
					return submissions.length < 3 ? new WireRejection(message) : { turn: { id: "followup" } };
				}
				if (request.method === "thread/turns/list") {
					polls += 1;
					return { data: [{ id: "active", items: [], status: polls % 2 === 1 ? "inProgress" : "completed" }], nextCursor: null };
				}
				return {};
			});
			yield* Effect.gen(function* () {
				const receipt = yield* provider.startTurn({
					operationId: "followup-operation",
					prompt: "Continue the repair",
					sessionId: "worker-thread",
					settings: { effort: "high", model: "synthetic-model", serviceTier: "synthetic-tier" },
				});
				expect(receipt).toEqual({ sessionId: "worker-thread", turnId: "followup" });
			});
			expect(polls).toBe(4);
			expect(submissions).toEqual([submissions[0], submissions[0], submissions[0]]);
			expect(methods).not.toContain("turn/interrupt");
			expect(methods).not.toContain("thread/start");
		},
	);
}
providerStory.it("repeated busy races stop after three resubmissions with a definite rejection", [], function* ({ provider, replyWith }) {
	const methods: string[] = [];
	let reads = 0;
	yield* replyWith((request) => {
		methods.push(request.method);
		if (request.method === "thread/turns/list") {
			reads += 1;
		}
		return request.method === "turn/start"
			? new WireRejection("turn already active for thread")
			: { data: [{ id: "steered", items: [], status: reads % 2 === 1 ? "inProgress" : "completed" }], nextCursor: null };
	});
	yield* Effect.gen(function* () {
		const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
		expect(error.reason).toBe("rejected");
		expect(error.code).toBe("session-active-turn-exhausted");
		expect(error.message).toContain("active-turn resubmission limit reached");
	});
	expect(methods.filter((method) => method === "turn/start")).toHaveLength(4);
	expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(7);
});
for (const overloaded of [false, true]) {
	providerStory.it(
		`unreadable state and distinct rejection codes cannot authorize contention replay: overload=${overloaded}`,
		[],
		function* ({ provider, replyWith }) {
			const methods: string[] = [];
			yield* replyWith((request) => {
				methods.push(request.method);
				if (request.method === "turn/start") {
					return new WireRejection("turn already active for thread", undefined, overloaded ? -32_001 : -32_602);
				}
				return request.method === "thread/turns/list" ? new WireRejection("State observation is unavailable.") : {};
			});
			yield* Effect.gen(function* () {
				const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
				expect(error).toMatchObject({
					code: overloaded ? "session-queue-full" : "session-rejected",
					message: "Codex rejected the protocol request: turn already active for thread",
					reason: "rejected",
				});
			});
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(overloaded ? 0 : 1);
		},
	);
}
for (const message of [
	"Rejected credential",
	"Invalid API key",
	"Request refused by policy",
	"Selected model is at capacity",
	"Selected model is at capacity. Please try a different model.",
]) {
	providerStory.it(`an active thread cannot turn ${message} into contention replay`, [], function* ({ provider, replyWith }) {
		const methods: string[] = [];
		yield* replyWith((request) => {
			methods.push(request.method);
			return request.method === "turn/start"
				? new WireRejection(message)
				: { data: [{ id: "active", items: [], status: "inProgress" }], nextCursor: null };
		});
		yield* Effect.gen(function* () {
			const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
			expect(error).toMatchObject({ code: "session-rejected", message: `Codex rejected the protocol request: ${message}`, reason: "rejected" });
		});
		expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
		expect(methods).not.toContain("thread/turns/list");
	});
}
