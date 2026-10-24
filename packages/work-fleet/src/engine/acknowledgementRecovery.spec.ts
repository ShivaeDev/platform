import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { changedSecondBrief } from "#test/changedSecondBrief.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { pausedReview } from "#test/engineTimingTraits.ts";
import { failedBoardAcknowledgement, humanMergeRequired } from "#test/engineTraits.ts";

isolatedEngine.it(
	"applied action persists across acknowledgement failure and repeated resolve after restart repairs only acknowledgement",
	[engine.traits(failedBoardAcknowledgement, humanMergeRequired())],
	function* ({ acknowledgementAttempts, acknowledgements, launches, finishWorkers, prepareWork, respond, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const decision = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
		const responseId = respond(decision.id, "release");
		const applied = yield* fleet.resolve("one", decision.id, responseId);
		expect(applied.value.step).toBe("released");
		expect(applied.value.responses).toHaveLength(1);
		expect(applied.value.responses?.[0]?.boardAcknowledged).toBeUndefined();
		expect(applied.value.blocker).toContain("Board request acknowledgement pending");
		expect(acknowledgements()).toHaveLength(0);
		yield* restart();
		const repaired = yield* fleet.resolve("one", decision.id, responseId);
		expect(repaired.value.step).toBe("released");
		expect(repaired.value.responses).toHaveLength(1);
		expect(repaired.value.responses?.[0]?.boardAcknowledged).toBe(true);
		expect(repaired.value.blocker).toBeUndefined();
		expect((yield* fleet.resolve("one", decision.id, responseId)).version).toBe(repaired.version);
		expect(acknowledgementAttempts()).toHaveLength(2);
		expect(acknowledgements()[0]).toMatchObject({ disposition: "applied", responseId });
		expect(launches()).toHaveLength(2);
	},
);

isolatedEngine.it(
	"scheduler repairs a terminal released request acknowledgement after restart without launching work",
	[engine.traits(failedBoardAcknowledgement, humanMergeRequired())],
	function* ({ acknowledgements, launches, finishWorkers, prepareWork, respond, restart, fleet, schedule }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const decision = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
		yield* fleet.resolve("one", decision.id, respond(decision.id, "release"));
		yield* restart();
		yield* schedule();
		const repaired = yield* fleet.get("one");
		expect(repaired.value.step).toBe("released");
		expect(repaired.value.responses?.[0]?.boardAcknowledged).toBe(true);
		expect(acknowledgements()).toHaveLength(1);
		expect(launches()).toHaveLength(2);
	},
);

isolatedEngine.it(
	"renewal commits history before superseding its Board request and resumes acknowledgement after restart",
	[engine.traits(failedBoardAcknowledgement, humanMergeRequired())],
	function* ({ acknowledgements, launches, approveWork, editWork, finishWorkers, prepareWork, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const decision = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
		editWork("one", "board-one-renewed");
		approveWork("one", "board-one-renewed");
		const renewed = yield* prepareWork("one");
		expect(renewed.value.step).toBe("queued");
		expect(renewed.value.history?.[0]?.decision?.id).toBe(decision.id);
		expect(renewed.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
		expect(renewed.value.blocker).toContain("Board request acknowledgement pending");
		yield* restart();
		const repaired = yield* fleet.reconcile("one");
		expect(repaired.value.step).toBe("queued");
		expect(repaired.value.history?.[0]?.decisionAcknowledged).toBe(true);
		expect(acknowledgements()[0]).toMatchObject({ decision: decision.published, disposition: "superseded" });
		expect(launches()).toHaveLength(2);
	},
);

for (const type of ["clarify", "not_now"] as const) {
	isolatedEngine.it(
		`${type} remains open and repeated response processing never duplicates action or Board acknowledgement`,
		[humanMergeRequired()],
		function* ({ acknowledgementAttempts, launches, finishWorkers, prepareWork, respond, restart, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const decision = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
			const responseId = respond(decision.id, "retry", type);
			const first = yield* fleet.resolve("one", decision.id, responseId);
			yield* restart();
			const repeated = yield* fleet.resolve("one", decision.id, responseId);
			expect(repeated.version).toBe(first.version);
			expect(repeated.value.step).toBe("waiting");
			expect(repeated.value.responses).toHaveLength(1);
			expect(repeated.value.decision?.id).toBe(decision.id);
			expect(repeated.value.responses?.[0]?.action).toBeUndefined();
			expect(acknowledgementAttempts()).toHaveLength(0);
			expect(launches()).toHaveLength(2);
		},
	);
}

isolatedEngine.it(
	"decision acknowledgement remains usable while unrelated review waits",
	[pausedReview(), changedSecondBrief],
	function* ({ waitForTimingGate, releaseTimingGate, finishWorkers, prepareWork, respond, fleet }) {
		yield* prepareWork("one");
		yield* prepareWork("two");

		yield* fleet.dispatch("one");
		finishWorkers();
		const reviewing = yield* fleet.reconcile("one").pipe(Effect.forkChild);
		yield* waitForTimingGate();
		const pending = yield* fleet.dispatch("two");
		const id = pending.value.decision?.id ?? "missing";
		const applied = yield* fleet.resolve("two", id, respond(id, "release"));
		expect(applied.value.step).toBe("released");
		expect(applied.value.responses?.[0]?.boardAcknowledged).toBe(true);
		expect((yield* fleet.get("one")).value.step).toBe("reviewing");
		yield* releaseTimingGate();
		expect((yield* Fiber.join(reviewing)).value.step).toBe("done");
	},
);
