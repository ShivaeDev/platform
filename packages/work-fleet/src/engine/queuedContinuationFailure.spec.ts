import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { completedContinuation, continuationCapacity, fourApproved, needsHumanContinuation, observedQuota } from "#test/continuationCapacity.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { schedulerProvider } from "#test/schedulerProvider.ts";

for (const step of ["waiting", "done"] as const) {
	const resultKind = step === "waiting" ? needsHumanContinuation : completedContinuation;
	isolatedEngine.it(
		`a queued continuation of ${step} work stops for a changed brief and lets prepared work launch`,
		[continuationCapacity, resultKind, fourApproved],
		function* (fleet) {
			for (const id of ["one", "two", "three", "four"]) {
				yield* fleet.prepareWork(id);
			}
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe(step);
			yield* fleet.dispatch("two");
			yield* fleet.dispatch("three");
			yield* fleet.continueWork("one", "Fix the remaining case");
			fleet.reviseBrief("one", "revised-brief");
			yield* fleet.finishWorker("two");
			yield* fleet.reconcile("two");
			const stopped = (yield* fleet.reconcile("one")).value;
			expect(stopped).toMatchObject({
				attentionOwner: "orchestrator",
				decision: { code: "fleet-stale", reason: "Board context changed" },
				step: "waiting",
			});
			expect(stopped.pendingContinuation).toBeUndefined();
			yield* fleet.schedule();
			yield* outcomes([
				["one pending continuation", () => fleet.get("one").pipe(Effect.map((current) => current.value.pendingContinuation)), undefined],
				["four", () => fleet.stepOf("four"), "working"],
			]);
		},
	);
}

isolatedEngine.it(
	"a queued continuation reports unavailable quota and resumes when it returns",
	[continuationCapacity, completedContinuation, fourApproved, observedQuota],
	function* (fleet) {
		for (const id of ["one", "two", "three", "four"]) {
			yield* fleet.prepareWork(id);
		}
		const first = (yield* fleet.dispatch("one")).value;
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		yield* fleet.dispatch("three");
		yield* fleet.continueWork("one", "Fix the remaining case");
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
		expect(resumed.step).toBe("working");
		expect(resumed.pendingContinuation).toBeUndefined();
		expect(resumed.attempts[0]?.receipt?.sessionId).toBe(first.attempts[0]?.receipt?.sessionId);
		expect((yield* fleet.get("four")).value.step).toBe("queued");
	},
);

isolatedEngine.it(
	"a pass resumes a queued continuation after observing the turn that frees its slot",
	[continuationCapacity, completedContinuation, fourApproved, schedulerProvider],
	function* (fleet) {
		for (const id of ["one", "two", "three", "four"]) {
			yield* fleet.prepareWork(id);
		}
		const first = (yield* fleet.dispatch("one")).value;
		fleet.finishSchedulerTurn(first.attempts[0]?.receipt);
		yield* fleet.reconcile("one");
		const second = yield* fleet.dispatch("two");
		yield* fleet.dispatch("three");
		yield* fleet.continueWork("one", "Finish the queued change");
		fleet.finishSchedulerTurn(second.value.attempts[0]?.receipt);
		const provider = fleet.holdSchedulerObservation(second.value.attempts[0]?.receipt);
		const pass = yield* fleet.schedule().pipe(Effect.forkChild);
		yield* provider.entered;
		expect((yield* fleet.get("one")).value.pendingContinuation).toBe("Finish the queued change");
		yield* provider.release;
		yield* Fiber.join(pass);
		const resumed = (yield* fleet.get("one")).value;
		expect(resumed.step).toBe("working");
		expect(resumed.pendingContinuation).toBeUndefined();
		expect(resumed.attempts).toMatchObject([
			{
				prompt: "Finish the queued change",
				receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
				role: "repair",
			},
		]);
		yield* outcomes([
			["two", () => fleet.stepOf("two"), "done"],
			["three", () => fleet.stepOf("three"), "working"],
			["four", () => fleet.stepOf("four"), "queued"],
		]);
	},
);
