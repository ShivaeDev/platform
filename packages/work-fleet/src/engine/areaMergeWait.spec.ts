import { Effect } from "effect";
import { expect } from "vitest";
import { humanMergeCanArriveLate, mergeWaitIsFiveSeconds, reviewOutlivesMergeWait } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";

engine.it(
	"the default merge wait frees areas after thirty minutes and continues observing delivery across restart",
	[humanMergeCanArriveLate()],
	function* ({ fleet, prepareWork, finishWorkers, restart, setAreas, advanceTime, mergePullRequest }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value).toMatchObject({
			attentionOwner: "orchestrator",
			decision: { attentionOwner: "orchestrator" },
			mergeReadyAt: 100,
			mergeReadyHead: "head-one-0",
			stage: "needs-human",
		});
		advanceTime(1_800_000 - 1);
		yield* fleet.reconcile("one");
		expect((yield* fleet.get("one")).value.mergeReadyAt).toBe(100);
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.stage).toBe("prepared");
		advanceTime(1);
		yield* restart();
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		expect((yield* fleet.get("one")).value).toMatchObject({
			attentionOwner: "orchestrator",
			decision: { attentionOwner: "orchestrator" },
			stage: "needs-human",
		});
		mergePullRequest();
		expect((yield* fleet.reconcile("one")).value).toMatchObject({ outcome: { revision: "merged" }, stage: "completed" });
	},
);
engine.it(
	"a configured merge wait uses readiness time rather than worker start time",
	[mergeWaitIsFiveSeconds()],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, advanceTime, currentTime }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		advanceTime(20_000 - currentTime());
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(20_000);
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.stage).toBe("prepared");
		advanceTime(5000);
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	},
);
engine.it(
	"a worker or unfinished review holds its area regardless of elapsed time",
	[reviewOutlivesMergeWait()],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, advanceTime, currentTime }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		advanceTime(20_000 - currentTime());
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.stage).toBe("prepared");
		finishWorkers();
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.stage).toBe("reviewing");
		expect(reviewing.value.mergeReadyAt).toBeUndefined();
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
	},
);
