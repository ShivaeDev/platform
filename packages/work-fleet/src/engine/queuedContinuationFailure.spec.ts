import { expect } from "vitest";
import { completedContinuation, continuationCapacity, fourApproved, needsHumanContinuation, observedQuota } from "#test/continuationCapacity.ts";
import { fleetStory } from "#test/fleetStory.ts";

for (const stage of ["needs-human", "completed"] as const) {
	const resultKind = stage === "needs-human" ? needsHumanContinuation : completedContinuation;
	fleetStory.it(
		`a queued continuation of ${stage} work stops for a changed brief and lets prepared work launch`,
		[continuationCapacity, resultKind, fourApproved],
		function* (fleet) {
			for (const id of ["one", "two", "three", "four"]) {
				yield* fleet.prepare(id);
			}
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe(stage);
			yield* fleet.dispatch("two");
			yield* fleet.dispatch("three");
			yield* fleet.continue("one", "Fix the remaining case");
			fleet.reviseBrief("one", "revised-brief");
			yield* fleet.finishWorker("two");
			yield* fleet.reconcile("two");
			const stopped = (yield* fleet.reconcile("one")).value;
			expect(stopped).toMatchObject({
				attentionOwner: "orchestrator",
				decision: { code: "fleet-stale", reason: "Board context changed" },
				stage: "needs-human",
			});
			expect(stopped.pendingContinuation).toBeUndefined();
			yield* fleet.schedule();
			expect((yield* fleet.get("one")).value.pendingContinuation).toBeUndefined();
			expect((yield* fleet.get("four")).value.stage).toBe("executing");
		},
	);
}

fleetStory.it(
	"a queued continuation reports unavailable quota and resumes when it returns",
	[continuationCapacity, completedContinuation, fourApproved, observedQuota],
	function* (fleet) {
		for (const id of ["one", "two", "three", "four"]) {
			yield* fleet.prepare(id);
		}
		const first = (yield* fleet.dispatch("one")).value;
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		yield* fleet.dispatch("three");
		yield* fleet.continue("one", "Fix the remaining case");
		fleet.providerQuota(0);
		yield* fleet.finishWorker("two");
		yield* fleet.reconcile("two");
		expect((yield* fleet.reconcile("one")).value).toMatchObject({
			attentionOwner: "automation",
			blocker: "Fresh available provider quota is required",
			pendingContinuation: "Fix the remaining case",
		});
		fleet.providerQuota(100);
		yield* fleet.schedule();
		const resumed = (yield* fleet.get("one")).value;
		expect(resumed.stage).toBe("executing");
		expect(resumed.pendingContinuation).toBeUndefined();
		expect(resumed.attempts[0]?.receipt?.sessionId).toBe(first.attempts[0]?.receipt?.sessionId);
		expect((yield* fleet.get("four")).value.stage).toBe("prepared");
	},
);
