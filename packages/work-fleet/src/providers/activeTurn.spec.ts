import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, WireRejection } from "#test/codex.ts";

for (const message of ["turn already active for thread", "Another operation owns this thread."]) {
	it.live(`an active-turn rejection preserves submission across busy races independently of wording: ${message}`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const submissions: unknown[] = [];
				const methods: string[] = [];
				let polls = 0;
				const fixture = yield* codexServer((request) => {
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
					const provider = yield* SessionTransport;
					const receipt = yield* provider.startTurn({
						operationId: "followup-operation",
						prompt: "Continue the repair",
						sessionId: "worker-thread",
						settings: { effort: "high", model: "synthetic-model", serviceTier: "synthetic-tier" },
					});
					expect(receipt).toEqual({ sessionId: "worker-thread", turnId: "followup" });
				}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
				expect(polls).toBe(4);
				expect(submissions).toEqual([submissions[0], submissions[0], submissions[0]]);
				expect(methods).not.toContain("turn/interrupt");
				expect(methods).not.toContain("thread/start");
			}),
		),
	);
}

it.live("a rejected request on an idle thread fails without resubmission", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				return request.method === "turn/start" ? new WireRejection("turn already active for thread") : { data: [], nextCursor: null };
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
				expect(error).toMatchObject({
					code: "session-rejected",
					message: "Codex rejected the protocol request: turn already active for thread",
					reason: "rejected",
				});
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(1);
		}),
	),
);

it.live("repeated busy races stop after three resubmissions with a definite rejection", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			let reads = 0;
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method === "thread/turns/list") {
					reads += 1;
				}
				return request.method === "turn/start"
					? new WireRejection("turn already active for thread")
					: { data: [{ id: "steered", items: [], status: reads % 2 === 1 ? "inProgress" : "completed" }], nextCursor: null };
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
				expect(error.reason).toBe("rejected");
				expect(error.code).toBe("session-active-turn-exhausted");
				expect(error.message).toContain("active-turn resubmission limit reached");
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(4);
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(7);
		}),
	),
);

for (const overloaded of [false, true]) {
	it.live(`unreadable state and distinct rejection codes cannot authorize contention replay: overload=${overloaded}`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const methods: string[] = [];
				const fixture = yield* codexServer((request) => {
					methods.push(request.method);
					if (request.method === "turn/start") {
						return new WireRejection("turn already active for thread", undefined, overloaded ? -32_001 : -32_602);
					}
					return request.method === "thread/turns/list" ? new WireRejection("State observation is unavailable.") : {};
				});
				yield* Effect.gen(function* () {
					const provider = yield* SessionTransport;
					const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
					expect(error).toMatchObject({
						code: overloaded ? "session-queue-full" : "session-rejected",
						message: "Codex rejected the protocol request: turn already active for thread",
						reason: "rejected",
					});
				}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
				expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
				expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(overloaded ? 0 : 1);
			}),
		),
	);
}

for (const message of ["Rejected credential", "Invalid API key", "Request refused by policy", "Selected model is at capacity"]) {
	it.live(`an active thread cannot turn ${message} into contention replay`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const methods: string[] = [];
				const fixture = yield* codexServer((request) => {
					methods.push(request.method);
					return request.method === "turn/start"
						? new WireRejection(message)
						: { data: [{ id: "active", items: [], status: "inProgress" }], nextCursor: null };
				});
				yield* Effect.gen(function* () {
					const provider = yield* SessionTransport;
					const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
					expect(error).toMatchObject({ code: "session-rejected", message: `Codex rejected the protocol request: ${message}`, reason: "rejected" });
				}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
				expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
				expect(methods).not.toContain("thread/turns/list");
			}),
		),
	);
}
