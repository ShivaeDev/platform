import { expect } from "@effect/vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { failureCode } from "#engine/failureCode.ts";
import { capacityCase, capacityRecovery } from "#test/capacityRecovery.ts";
import { daemonBoard, daemonRecovery } from "#test/daemonRecovery.ts";
import { recoveryCapacityCases } from "#test/recoveryCapacityCases.ts";

const capacity = storyKit(capacityRecovery);
const daemon = storyKit(daemonRecovery);

for (const scenario of recoveryCapacityCases) {
	capacity.it(
		`${scenario.code}: ${scenario.name}`,
		[capacityCase(scenario.call)],
		function* ({
			fleet,
			prepareWork,
			finishWorkers,
			schedule,
			restart,
			launches,
			publishedDecisions,
			queueRejection,
			providerHasRoom,
			capacityClock,
			quotaDenial,
			quotaBlocked,
			inventory,
		}) {
			const originalWorker = 1;
			expect(inventory()).toEqual({ codes: [], obsoleteSites: [], sites: [] });
			if (scenario.call === "quota") {
				yield* prepareWork("one");
				const worker = (yield* fleet.dispatch("one")).value.attempts[0]?.receipt;
				finishWorkers();
				quotaBlocked(true);
				const waiting = (yield* fleet.reconcile("one")).value;
				expect(failureCode(quotaDenial())).toBe("provider-quota-unavailable");
				expect(waiting).toMatchObject({
					attentionOwner: "automation",
					blocker: "The provider budget needs to refresh before another operation can start.",
					step: "reviewing",
				});
				expect(waiting.decision).toBeUndefined();
				expect(waiting.attempts).toHaveLength(originalWorker);
				yield* restart();
				const resumed = (yield* fleet.reconcile("one")).value;
				expect(resumed).toEqual({ ...waiting, updatedAt: resumed.updatedAt });
				expect(resumed.updatedAt).toBeGreaterThanOrEqual(waiting.updatedAt ?? 0);
				quotaBlocked(false);
				yield* restart();
				const completed = (yield* fleet.reconcile("one")).value;
				expect(completed.step).toBe("done");
				expect(completed.attempts[0]?.receipt).toEqual(worker);
				const workerAndReviewer = 2;
				expect(completed.attempts).toHaveLength(workerAndReviewer);
				expect(publishedDecisions()).toEqual([]);
				return;
			}
			yield* prepareWork("one");
			yield* schedule();
			const queued = (yield* fleet.get("one")).value;
			expect(queueRejection()?.code).toBe("session-queue-full");
			expect(queued).toMatchObject({
				attentionOwner: "automation",
				launchRetry: { rejectedAt: 100, rejections: 1, retryAt: 30_100 },
				step: "queued",
			});
			expect(queued.attempts[0]).toMatchObject({ output: "Please wait until the provider has room for another operation.", status: "failed" });
			expect(queued.decision).toBeUndefined();
			providerHasRoom();
			capacityClock(30_099);
			yield* restart();
			yield* schedule();
			const backedOff = (yield* fleet.get("one")).value;
			expect(backedOff.launchRetry).toEqual(queued.launchRetry);
			expect(launches()).toHaveLength(originalWorker);
			capacityClock(30_100);
			yield* restart();
			yield* schedule();
			const accepted = (yield* fleet.get("one")).value;
			expect(accepted.step).toBe("working");
			expect(accepted.launchRetry).toBeUndefined();
			expect(accepted.attempts.at(-1)?.receipt).toBeDefined();
			const sessionsAfterRetry = scenario.call === "turn" ? originalWorker : originalWorker + 1;
			expect(launches()).toHaveLength(sessionsAfterRetry);
			if (scenario.call === "turn") {
				expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(queued.attempts[0]?.sessionId);
			}
			expect(publishedDecisions()).toEqual([]);
		},
	);
}
for (const action of ["retry", "release"] as const) {
	daemon.it(
		`HTTP daemon closes before the ${action} answer and restarts against the same PostgreSQL records`,
		[daemonBoard],
		function* ({ stopDaemon }) {
			const failedDaemon = yield* stopDaemon();
			const { decision, dispatched, stopped } = failedDaemon;
			expect(dispatched.decision).toBeUndefined();
			expect(dispatched.step).toBe("working");
			expect(stopped.step).toBe("waiting");
			const responseId = failedDaemon.answerOffline(action);
			const { resolved, fresh } = yield* failedDaemon.restart(action, responseId);
			expect(resolved.responses).toContainEqual(expect.objectContaining({ action, boardAcknowledged: true, decisionId: decision.id, responseId }));
			if (action === "release") {
				expect(resolved.step).toBe("released");
			} else {
				const originalAndReplacement = 2;
				expect(fresh.attempts).toHaveLength(originalAndReplacement);
				expect(fresh.step).toBe("working");
				expect(fresh.decision).toBeUndefined();
			}
		},
		30_000,
	);
}
