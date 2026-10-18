import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { cloudRecovery, timedProviderStory } from "#test/providerStory.ts";

for (const evidence of ["matching", "unrelated", "empty"] as const) {
	timedProviderStory.it(
		`waits for a continuation on a non-empty thread without replay: evidence=${evidence}`,
		[cloudRecovery(5000)],
		function* ({ provider, replyWith, requests, awaitSleep }) {
			let observable = false;
			yield* replyWith(() => {
				const matching = observable && evidence === "matching";
				const turn = {
					id: matching ? "answer-turn" : "question-turn",
					items: [{ clientId: matching ? "answer-operation" : "question-operation", id: "input", type: "userMessage" }],
					status: matching ? "inProgress" : "completed",
				};
				return { data: observable && evidence === "empty" ? [] : [turn], nextCursor: null };
			});
			const recovering = yield* provider
				.reconcile({ operationId: "answer-operation", resume: { prompt: "Recorded answer" }, sessionId: "thread" })
				.pipe(Effect.result, Effect.forkChild);
			for (let step = 0; step < 19; step += 1) {
				yield* awaitSleep(250);
				yield* TestClock.adjust(250);
			}
			yield* awaitSleep(250);
			yield* TestClock.adjust(249);
			expect(recovering.pollUnsafe()).toBeUndefined();
			observable = evidence !== "unrelated";
			yield* TestClock.adjust(1);
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
			expect(requests().filter((request) => request.method === "thread/turns/list").length).toBeGreaterThan(1);
			expect(requests().map((request) => request.method)).not.toContain("turn/start");
			expect(requests().map((request) => request.method)).not.toContain("thread/start");
		},
	);
}
