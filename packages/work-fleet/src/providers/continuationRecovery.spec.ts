import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { continuationEvidence } from "#test/continuationEvidence.ts";

for (const evidence of ["matching", "unrelated", "empty"] as const) {
	it.effect(`waits for a continuation on a non-empty thread without replay: evidence=${evidence}`, function* () {
		const requests: string[] = [];
		let observable = false;
		const rpc = continuationEvidence(requests, () => (observable ? evidence : "unrelated"));
		const provider = codexAdapter(rpc, {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			recoveryGraceMs: 5000,
			threadStart: () => ({}),
		});
		const recovering = yield* provider
			.reconcile({
				operationId: "answer-operation",
				resume: { prompt: "Recorded answer" },
				sessionId: "thread",
			})
			.pipe(Effect.result, Effect.forkChild);
		yield* TestClock.adjust("4999 millis");
		expect(recovering.pollUnsafe()).toBeUndefined();
		observable = evidence !== "unrelated";
		yield* TestClock.adjust("1 milli");
		const result = yield* Fiber.join(recovering);
		if (evidence === "matching") {
			expect(result).toMatchObject({ _tag: "Success", success: { sessionId: "thread", turnId: "answer-turn" } });
		} else {
			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					code: "session-turn-missing",
					message: "No matching accepted turn is observable; absence does not authorize replay",
					reason: "ambiguous",
				},
			});
		}
		expect(requests.length).toBeGreaterThan(1);
		expect(requests).not.toContain("turn/start");
		expect(requests).not.toContain("thread/start");
	});
}
