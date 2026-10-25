import { describe, expect } from "@effect/vitest";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { queuedContinuation } from "#test/queuedContinuation.ts";

describe("continuation launch backpressure", () => {
	for (const checksFailure of [false, true]) {
		{
			let now = 100;
			let reject = false;
			let checksBlocked = checksFailure;
			const launch = { model: "initial-model" };
			const queuedContinuationTrait = engineConfiguration(
				"queued continuation",
				queuedContinuation({ checksBlocked: () => checksBlocked, launch: () => launch, now: () => now, reject: () => reject }),
			);
			engine.it(
				`a rejected continuation from ${checksFailure ? "waiting" : "completed"} retries its saved message on the same thread`,
				[queuedContinuationTrait],
				function* ({ launches, providerCalls, finishWorkers, prepareWork, restart, fleet, schedule }) {
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					finishWorkers();
					const stopped = (yield* fleet.reconcile("one")).value;
					expect(stopped.step).toBe(checksFailure ? "waiting" : "done");
					const sessionId = stopped.attempts[0]?.receipt?.sessionId;
					checksBlocked = false;
					reject = true;
					const rejectedAt = now;
					const queued = (yield* fleet.continue("one", "Check another case")).value;
					expect(queued.attentionOwner).toBe("automation");
					expect(queued.step).toBe("repairing");
					expect(queued.launchRetry?.retryAt).toBe(rejectedAt + 30_000);
					expect(queued.history).toMatchObject([{ attempts: stopped.attempts, step: stopped.step }]);
					const calls = providerCalls().length;
					reject = false;
					launch.model = "new-host-model";
					now = 30_099;
					yield* restart();
					yield* schedule();
					expect(providerCalls()).toHaveLength(calls);
					now = 30_100;
					yield* restart();
					yield* schedule();
					const accepted = (yield* fleet.get("one")).value;
					expect(accepted.step).toBe("working");
					expect(accepted.launchRetry).toBeUndefined();
					expect(accepted.attentionOwner).toBeUndefined();
					expect(accepted.attempts.at(-1)).toMatchObject({
						prompt: "Check another case",
						receipt: { sessionId },
						role: "repair",
						settings: { model: "initial-model" },
					});
					expect(accepted.history).toMatchObject([{ attempts: stopped.attempts, step: stopped.step }]);
					expect(launches()).toEqual(["operation-1", "operation-2"]);
					finishWorkers();
					expect((yield* fleet.reconcile("one")).value).toMatchObject({ outcome: { evidence: ["Check another case"] }, step: "done" });
				},
			);
		}
	}
});
