import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { heldAction } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { repairReportsCanBeAdopted, workerReportsCanBeAdopted } from "#test/engineWorkerReportTraits.ts";
import { HEAD, NO_CHANGE, REPORT } from "#test/githubResult.ts";

isolatedEngine.it(
	"a repair report receives its correction on the existing worker thread without archiving the cycle",
	[repairReportsCanBeAdopted()],
	function* ({ workerReportReply, fleet, prepareWork, reviewedHeads }) {
		yield* prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		const original = yield* workerReportReply(dispatched, REPORT);
		const repair = yield* fleet.reconcile("one");
		expect(repair.value.attempts.at(-1)?.role).toBe("repair");
		yield* workerReportReply(repair, "Missing repair report");
		const correction = yield* fleet.reconcile("one");
		expect(correction.value.step).toBe("working");
		expect(correction.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: original.sessionId });
		expect(correction.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2", "operation-3", "operation-4"]);
		expect(correction.value.history).toBeUndefined();
		yield* workerReportReply(correction, NO_CHANGE);
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		expect(reviewedHeads()).toEqual([HEAD, HEAD]);
	},
);

isolatedEngine.it(
	"persists the correction before provider acceptance and reconciles its lost acknowledgement after restart",
	[heldAction("correction")],
	function* ({ releaseGate, waitForGate, workerReportReply, fleet, prepareWork, afterRestart, launches, providerCalls, providerOperations }) {
		yield* prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		const original = yield* workerReportReply(dispatched, "Missing report");
		const following = yield* fleet.reconcile("one").pipe(Effect.forkChild);
		yield* waitForGate("entered");
		const intent = yield* afterRestart(Effect.flatMap(Fleet, (restarted) => restarted.get("one")));
		const attempt = intent.value.attempts.at(-1);
		expect(intent.value.step).toBe("working");
		expect(intent.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2"]);
		expect(attempt).toMatchObject({ role: "worker", sessionId: original.sessionId, status: "submitting" });
		expect(attempt?.prompt).toContain("Reply only with a corrected report");
		expect(attempt?.receipt).toBeUndefined();
		expect(providerOperations()).toEqual(["operation-1"]);
		yield* releaseGate("release");
		const lost = yield* Fiber.join(following);
		expect(lost.value.attempts.at(-1)?.operationId).toBe(attempt?.operationId);
		expect(lost.value.attempts.at(-1)?.receipt).toBeUndefined();
		expect(providerOperations()).toEqual(["operation-1", "operation-2"]);
		const recovered = yield* afterRestart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
		expect(recovered.value.attempts.at(-1)).toMatchObject({ operationId: attempt?.operationId, status: "running" });
		expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).toBe(original.sessionId);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1", "operation-2"]);
		yield* workerReportReply(recovered, NO_CHANGE);
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.step).toBe("done");
		expect(completed.value.result).toMatchObject({ head: HEAD, kind: "no-change" });
		expect(launches()).toEqual(["operation-1", "operation-3"]);
	},
);

isolatedEngine.it(
	"a malformed human-requested retry returns to waiting without another automatic follow-up",
	[workerReportsCanBeAdopted()],
	function* ({ workerReportReply, fleet, prepareWork, afterRestart, respond, publishedDecisions, providerCalls, reviewedHeads }) {
		yield* prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		yield* workerReportReply(dispatched, "Missing report");
		const followUp = yield* fleet.reconcile("one");
		yield* workerReportReply(followUp, "Still missing");
		const blocked = yield* fleet.reconcile("one");
		const decisionId = blocked.value.decision?.id ?? "missing";
		respond(decisionId, "retry");
		const retry = yield* fleet.reconcile("one");
		expect(retry.value.step).toBe("working");
		expect(retry.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2", "operation-3"]);
		yield* workerReportReply(retry, `${REPORT}\nTrailing text`);
		const malformed = yield* afterRestart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
		expect(malformed.value.step).toBe("waiting");
		expect(malformed.value.decision?.id).not.toBe(decisionId);
		expect(malformed.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2", "operation-3"]);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1", "operation-2", "operation-3"]);
		expect(publishedDecisions()).toEqual([blocked.value.decision?.reason, malformed.value.decision?.reason]);
		expect(reviewedHeads()).toHaveLength(0);
	},
);
