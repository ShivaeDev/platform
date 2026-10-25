import { expect } from "vitest";
import { completedContinuation, continuationCapacity, fourApproved, needsHumanContinuation, singleSlot } from "#test/continuationCapacity.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const step of ["waiting", "done"] as const) {
	const resultKind = step === "waiting" ? needsHumanContinuation : completedContinuation;

	isolatedEngine.it(
		`a continuation of ${step} work waits durably ahead of prepared work at full capacity`,
		[continuationCapacity, resultKind, fourApproved],
		function* (fleet) {
			for (const id of ["one", "two", "three", "four"]) {
				yield* fleet.prepareWork(id);
			}
			const first = (yield* fleet.dispatch("one")).value;
			fleet.finishWorkers();
			const terminal = (yield* fleet.reconcile("one")).value;
			expect(terminal.step).toBe(step);
			yield* fleet.dispatch("two");
			yield* fleet.dispatch("three");
			const queued = (yield* fleet.continueWork("one", "Fix the remaining case")).value;
			expect(queued).toMatchObject({
				attentionOwner: "automation",
				blocker: "Continuation queued; execution capacity is occupied (limit 2)",
				pendingContinuation: "Fix the remaining case",
				step,
			});
			expect(queued.attempts).toEqual(terminal.attempts);
			expect(queued.result).toEqual(terminal.result);
			expect(queued.review).toEqual(terminal.review);
			expect(queued.history).toBeUndefined();
			yield* fleet.restart();
			yield* fleet.schedule();
			expect((yield* fleet.get("one")).value).toMatchObject({
				attentionOwner: "automation",
				blocker: "execution capacity is occupied (limit 2)",
				pendingContinuation: "Fix the remaining case",
			});
			yield* fleet.finishWorker("two");
			yield* fleet.reconcile("two");
			expect(yield* fleet.attemptDispatch("four")).toMatchObject({ _tag: "StorageCapacity", kind: "merge-work" });
			yield* fleet.schedule();
			const resumed = (yield* fleet.get("one")).value;
			expect(resumed.step).toBe("working");
			expect(resumed.pendingContinuation).toBeUndefined();
			expect(resumed.attempts).toMatchObject([
				{
					prompt: "Fix the remaining case",
					receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
					role: "repair",
				},
			]);
			expect(resumed.history?.map((cycle) => cycle.review)).toEqual([terminal.review]);
			expect(resumed.history?.[0]).not.toHaveProperty("pendingContinuation");
			expect(resumed.history?.[0]?.attentionOwner).toBe(terminal.attentionOwner);
			expect(resumed.history?.[0]?.blocker).toBe(terminal.blocker);
			expect((yield* fleet.get("three")).value.step).toBe("working");
			expect((yield* fleet.get("four")).value.step).toBe("queued");
			yield* fleet.schedule();
			const observed = (yield* fleet.get("one")).value;
			expect(observed.attempts).toMatchObject([{ receipt: resumed.attempts[0]?.receipt }]);
		},
	);
}

isolatedEngine.it("additional instructions join the queued continuation on the same worker thread", [singleSlot], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	const first = (yield* fleet.dispatch("one")).value;
	yield* fleet.workerQuestion("one", "Which behavior should I implement?");
	yield* fleet.reconcile("one");
	yield* fleet.dispatch("two");
	yield* fleet.continueWork("one", "Fix the remaining case");
	const queued = (yield* fleet.continueWork("one", "Also cover empty inputs")).value;
	expect(queued.pendingContinuation).toBe("Fix the remaining case\n\nAlso cover empty inputs");
	yield* fleet.finishWorker("two");
	yield* fleet.reconcile("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.attempts[0]).toMatchObject({
		prompt: "Fix the remaining case\n\nAlso cover empty inputs",
		receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
	});
});

isolatedEngine.it("releasing a queued continuation cancels its request and lets prepared work launch", [singleSlot], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	yield* fleet.dispatch("one");
	yield* fleet.workerQuestion("one", "Which behavior should I implement?");
	yield* fleet.reconcile("one");
	yield* fleet.dispatch("two");
	yield* fleet.continueWork("one", "Fix the remaining case");
	expect((yield* fleet.answerDecision("one", "release")).value.pendingContinuation).toBeUndefined();
	fleet.finishWorkers();
	yield* fleet.reconcile("two");
	fleet.setDependencies("dependent", []);
	yield* fleet.prepareWork("dependent");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.step).toBe("released");
	expect((yield* fleet.get("one")).value.history ?? []).toHaveLength(0);
	expect((yield* fleet.get("dependent")).value.step).toBe("working");
});
