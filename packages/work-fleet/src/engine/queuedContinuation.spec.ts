import { expect } from "vitest";
import { completedContinuation, continuationCapacity, fourApproved, needsHumanContinuation, singleSlot } from "#test/continuationCapacity.ts";
import { fleetStory } from "#test/fleetStory.ts";

for (const stage of ["needs-human", "completed"] as const) {
	const resultKind = stage === "needs-human" ? needsHumanContinuation : completedContinuation;

	fleetStory.it(
		`a continuation of ${stage} work waits durably ahead of prepared work at full capacity`,
		[continuationCapacity, resultKind, fourApproved],
		function* (fleet) {
			for (const id of ["one", "two", "three", "four"]) {
				yield* fleet.prepare(id);
			}
			const first = (yield* fleet.dispatch("one")).value;
			fleet.finishWorkers();
			const terminal = (yield* fleet.reconcile("one")).value;
			expect(terminal.stage).toBe(stage);
			yield* fleet.dispatch("two");
			yield* fleet.dispatch("three");
			const queued = (yield* fleet.continue("one", "Fix the remaining case")).value;
			expect(queued).toMatchObject({
				attentionOwner: "automation",
				blocker: "Continuation queued; execution capacity is occupied (limit 2)",
				pendingContinuation: "Fix the remaining case",
				stage,
			});
			expect(queued.attempts).toEqual(terminal.attempts);
			expect(queued.result).toEqual(terminal.result);
			expect(queued.review).toEqual(terminal.review);
			expect(queued.history).toBeUndefined();
			yield* fleet.rebuild();
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
			expect(resumed.stage).toBe("executing");
			expect(resumed.pendingContinuation).toBeUndefined();
			expect(resumed.attempts).toHaveLength(1);
			expect(resumed.attempts[0]).toMatchObject({
				prompt: "Fix the remaining case",
				receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(resumed.history).toHaveLength(1);
			expect(resumed.history?.[0]?.review).toEqual(terminal.review);
			expect(resumed.history?.[0]).not.toHaveProperty("pendingContinuation");
			expect(resumed.history?.[0]?.attentionOwner).toBe(terminal.attentionOwner);
			expect(resumed.history?.[0]?.blocker).toBe(terminal.blocker);
			expect((yield* fleet.get("three")).value.stage).toBe("executing");
			expect((yield* fleet.get("four")).value.stage).toBe("prepared");
			yield* fleet.schedule();
			const observed = (yield* fleet.get("one")).value;
			expect(observed.attempts).toHaveLength(1);
			expect(observed.attempts[0]?.receipt).toEqual(resumed.attempts[0]?.receipt);
		},
	);
}

fleetStory.it("additional instructions join the queued continuation on the same worker thread", [singleSlot], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	const first = (yield* fleet.dispatch("one")).value;
	yield* fleet.workerQuestion("one", "Which behavior should I implement?");
	yield* fleet.reconcile("one");
	yield* fleet.dispatch("two");
	yield* fleet.continue("one", "Fix the remaining case");
	const queued = (yield* fleet.continue("one", "Also cover empty inputs")).value;
	expect(queued.pendingContinuation).toBe("Fix the remaining case\n\nAlso cover empty inputs");
	yield* fleet.finishWorker("two");
	yield* fleet.reconcile("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.attempts[0]).toMatchObject({
		prompt: "Fix the remaining case\n\nAlso cover empty inputs",
		receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
	});
});

fleetStory.it("releasing a queued continuation cancels its request and lets prepared work launch", [singleSlot], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	yield* fleet.dispatch("one");
	yield* fleet.workerQuestion("one", "Which behavior should I implement?");
	yield* fleet.reconcile("one");
	yield* fleet.dispatch("two");
	yield* fleet.continue("one", "Fix the remaining case");
	expect((yield* fleet.answerDecision("one", "release")).value.pendingContinuation).toBeUndefined();
	fleet.finishWorkers();
	yield* fleet.reconcile("two");
	fleet.dependencies("dependent", []);
	yield* fleet.prepare("dependent");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.stage).toBe("released");
	expect((yield* fleet.get("one")).value.history ?? []).toHaveLength(0);
	expect((yield* fleet.get("dependent")).value.stage).toBe("executing");
});
