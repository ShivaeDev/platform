import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";
import { recoveryEvidence, uncertainEvidence } from "#test/recoveryEvidence.ts";

const input = {
	operationId: "operation",
	resume: { access: "read-only" as const, prompt: "Approved work", settings: { effort: "high", model: "synthetic-model", serviceTier: "priority" } },
	sessionId: "synthetic-session",
};

it.effect("waits the bounded grace period and concurrent recovery starts once on the acknowledged empty thread", function* () {
	const requests: string[] = [];
	const rpc: CodexRequest = (method, params) =>
		Effect.sync(() => {
			requests.push(method);
			if (method === "turn/start") {
				expect(params).toMatchObject({
					...input.resume.settings,
					clientUserMessageId: input.operationId,
					input: [{ text: input.resume.prompt, type: "text" }],
					threadId: input.sessionId,
				});
				return { turn: { id: "synthetic-turn" } };
			}
			return { data: [], nextCursor: null };
		});
	const provider = codexAdapter(rpc, {
		beforeTurn: (turn) =>
			Effect.sync(() => {
				expect(turn).toMatchObject(input.resume);
				return {};
			}),
		provisioning: "unknown",
		recoveryGraceMs: 5000,
		threadStart: () => ({}),
	});
	const recovering = yield* Effect.all([provider.reconcile(input), provider.reconcile(input)], { concurrency: "unbounded" }).pipe(Effect.forkChild);
	yield* TestClock.adjust("4999 millis");
	expect(requests).not.toContain("turn/start");
	yield* TestClock.adjust("1 milli");
	expect(yield* Fiber.join(recovering)).toEqual([
		{ sessionId: input.sessionId, turnId: "synthetic-turn" },
		{ sessionId: input.sessionId, turnId: "synthetic-turn" },
	]);
	expect(requests.filter((method) => method === "turn/start")).toHaveLength(1);
	expect(requests).not.toContain("thread/start");
});

for (const scenario of uncertainEvidence) {
	it.effect(`retains ownership without replay for ${scenario}`, function* () {
		const requests: string[] = [];
		const provider = codexAdapter(recoveryEvidence(scenario, requests), {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			recoveryGraceMs: 5000,
			threadStart: () => ({}),
		});
		const result = yield* provider
			.reconcile({
				...input,
				...(scenario === "missing-session" ? { sessionId: undefined } : {}),
				...(scenario === "missing-prompt" ? { resume: undefined } : {}),
			})
			.pipe(Effect.result);
		expect(result._tag).toBe("Failure");
		expect(requests).not.toContain("thread/start");
		expect(requests).not.toContain("turn/start");
	});
}
