import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { pendingRequiredChecks, unconfiguredAdoption } from "#test/attentionOwnerTraits.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const owner of ["orchestrator", "maintainer"] as const) {
	engine.it(`persists ${owner} worker question routing through restart`, [], function* ({ launches, workerReports, prepareWork, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(`${owner === "maintainer" ? "FLEET_MAINTAINER_QUESTION" : "FLEET_QUESTION"}: Choose the API.`);
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.attentionOwner).toBe(owner);
		expect(waiting.value.decision?.attentionOwner).toBe(owner);
		yield* restart();
		expect((yield* fleet.get("one")).value.attentionOwner).toBe(owner);
		expect(launches()).toEqual(["operation-1"]);
	});
}

for (const owner of ["orchestrator", "automation"] as const) {
	const unconfiguredAdoptionTrait = engineConfiguration("unconfigured adoption", unconfiguredAdoption({ owner: () => owner }));
	engine.it(
		`integration failures ${owner === "orchestrator" ? "default to the orchestrator" : "explicitly route configuration gaps to automation"}`,
		[unconfiguredAdoptionTrait],
		function* ({ finishWorkers, prepareWork, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe(owner);
		},
	);
}

engine.it("a routine failed worker waits on the orchestrator", [], function* ({ setWorkerExecution, prepareWork, fleet }) {
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	setWorkerExecution("failed");
	expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe("orchestrator");
});

{
	let pending = true;
	const pendingRequiredChecksTrait = engineConfiguration("pending required checks", pendingRequiredChecks({ pending: () => pending }));
	engine.it(
		"pending checks persist automation ownership and completion clears it",
		[pendingRequiredChecksTrait],
		function* ({ finishWorkers, prepareWork, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe("automation");
			pending = false;
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.attentionOwner).toBeUndefined();
		},
	);
}

engine.it(
	"RPC reassignment publishes maintainer ownership, supersedes the old question and continues only from the new answer",
	[markdownWork()],
	function* ({ archivedSessions, answerWorker, launches, providerCalls, rpcReassign, rpcViews, workerQuestion, prepareWork, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const oldStopped = yield* fleet.reconcile("one");
		const oldDecision = oldStopped.value.decision;
		if (oldDecision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const old = { decision: oldDecision, published: oldDecision.published, stopped: oldStopped };
		const oldAnswer = yield* answerWorker(old.decision, "response.old");
		const reassigned = yield* rpcReassign({ attentionOwner: "maintainer", decisionId: old.decision.id, workId: "one" });
		expect(reassigned.attentionOwner).toBe("maintainer");
		expect(reassigned.decision?.id).not.toBe(old.decision.id);
		expect(reassigned.decision?.worker).toEqual(old.decision.worker);
		expect(archivedSessions()).toEqual([]);
		expect(reassigned.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: old.published }]);
		expect((yield* rpcViews()).waiting.maintainer).toMatchObject([{ decision: { id: reassigned.decision?.id }, workId: "one" }]);
		expect((yield* rpcViews()).waiting.orchestrator).toHaveLength(0);
		expect(yield* fleet.resolve("one", old.decision.id, oldAnswer.id).pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
		const decision = reassigned.decision;
		if (decision === undefined) {
			return yield* Effect.die("Missing reassigned decision");
		}
		const answer = yield* answerWorker(decision, "response.new");
		yield* restart();
		const restarted = fleet;
		const resumed = yield* restarted.resolve("one", decision.id, answer.id);
		expect(resumed.value.step).toBe("working");
		expect(resumed.value.attentionOwner).toBeUndefined();
		expect(launches()).toEqual(["operation-1"]);
		expect(archivedSessions()).toEqual([]);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map(({ operationId }) => operationId),
		).toEqual(["operation-1", "operation-2"]);
	},
);
