import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, WireRejection } from "#test/codex.ts";

it.live("an active-turn wire rejection waits for terminal evidence and preserves the submission across a second busy race", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const submissions: unknown[] = [];
			const methods: string[] = [];
			let polls = 0;
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				if (request.method === "turn/start") {
					submissions.push(request.params);
					return submissions.length < 3 ? new WireRejection("turn already active for thread") : { turn: { id: "followup" } };
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

it.live("other definite turn rejections still fail without polling or replay", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				return request.method === "turn/start" ? new WireRejection("thread is unavailable") : {};
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
				expect(error).toMatchObject({ message: "Codex rejected the protocol request: thread is unavailable", reason: "rejected" });
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(1);
			expect(methods).not.toContain("thread/turns/list");
		}),
	),
);

it.live("repeated busy races stop after three resubmissions with a definite rejection", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const methods: string[] = [];
			const fixture = yield* codexServer((request) => {
				methods.push(request.method);
				return request.method === "turn/start"
					? new WireRejection("turn already active for thread")
					: { data: [{ id: "finished", items: [], status: "completed" }], nextCursor: null };
			});
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const error = yield* provider.startTurn({ operationId: "operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
				expect(error.reason).toBe("rejected");
				expect(error.message).toContain("active-turn resubmission limit reached");
			}).pipe(Effect.provide(codexConfiguration(fixture.endpoint)));
			expect(methods.filter((method) => method === "turn/start")).toHaveLength(4);
			expect(methods.filter((method) => method === "thread/turns/list")).toHaveLength(3);
		}),
	),
);
