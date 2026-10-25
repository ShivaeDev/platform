import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { backlog } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"continuing work waiting on a human merge retains the reviewed head and worker thread without replay",
	[humanMergeRequired()],
	function* ({ launches, mergedHeads, providerCalls, providerOperations, finishWorkers, prepareWork, restart, fleet }) {
		yield* prepareWork("one");
		const first = yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.step).toBe("waiting");
		expect(ready.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
		expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
		expect(ready.value.review?.head).toBe(ready.value.result?.head);
		expect(ready.value.checks).toMatchObject({ head: ready.value.result?.head, passed: true });
		const continued = yield* fleet.continue("one", "Change again");
		expect(continued.value.step).toBe("working");
		expect(continued.value.attentionOwner).toBeUndefined();
		expect(continued.value.history?.[0]?.attentionOwner).toBe("orchestrator");
		expect(continued.value.result).toEqual(ready.value.result);
		expect(continued.value.history?.[0]?.review).toEqual(ready.value.review);
		expect(continued.value.attempts[0]).toMatchObject({
			prompt: "Change again",
			receipt: { sessionId: first.value.attempts[0]?.receipt?.sessionId, turnId: "turn-operation-3" },
		});
		expect(continued.value.review).toBeUndefined();
		yield* restart();
		const restarted = fleet;
		const observed = yield* restarted.reconcile("one");
		expect(observed.value.result).toEqual(ready.value.result);
		expect(observed.value.history?.[0]?.review).toEqual(ready.value.review);
		expect(observed.value.attempts).toMatchObject([{ operationId: "operation-3", receipt: continued.value.attempts[0]?.receipt }]);
		expect((yield* restarted.reconcile("one")).value.attempts[0]?.receipt).toEqual(observed.value.attempts[0]?.receipt);
		expect(providerOperations()).toEqual(["operation-1", "operation-2", "operation-3"]);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1", "operation-2", "operation-3"]);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
		expect(mergedHeads()).toEqual([]);
	},
);

engine.it(
	"continuation retains the unresolved PR's backlog until the new result is adopted",
	[humanMergeRequired()],
	function* ({ finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const stopped = yield* fleet.reconcile("one");
		const continued = yield* fleet.continue("one", "Repair the PR");
		expect(backlog(continued.value)).toBe(true);
		expect(continued.value.result).toEqual(stopped.value.result);
		finishWorkers();
		const adopted = yield* fleet.reconcile("one");
		expect(adopted.value.result?.head).not.toBe(stopped.value.result?.head);
	},
);

engine.it(
	"continuation does not use an archived worker from a different thread after renewal",
	[noChangeReported()],
	function* ({ rejectNextTurn, providerOperations, approveWork, editWork, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		editWork("one", "renewed-board");
		approveWork("one", "renewed-board");
		yield* prepareWork("one");
		rejectNextTurn();
		expect((yield* fleet.dispatch("one")).value.step).toBe("waiting");
		expect(yield* fleet.continue("one", "Keep the current thread").pipe(Effect.flip)).toMatchObject({
			message: "Continue requires an existing worker receipt",
		});
		expect(providerOperations()).toEqual(["operation-1", "operation-2"]);
	},
);
