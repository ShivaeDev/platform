import { Effect } from "effect";
import { expect } from "vitest";
import { deliveryChangesAfterAreaRelease, deliveryEvidenceCanDisappear } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";

engine.it(
	"delivery changes after the merge wait do not reclaim freed areas",
	[deliveryChangesAfterAreaRelease()],
	function* ({ fleet, prepareWork, finishWorkers, respond, setDependencies, setAreas, advanceTime, closePullRequest, restoreDeliveryEvidence }) {
		for (const id of ["one", "two", "dependent"]) {
			setDependencies(id, []);
			setAreas(id, ["fleet/host"]);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		advanceTime(5000);
		yield* fleet.dispatch("two");
		closePullRequest();
		const previous = yield* fleet.reconcile("one");
		expect(previous.value.mergeAreasReleased).toBe(true);
		expect(previous.value.decision?.reason).toBe("PR closed without merging");
		expect(previous.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
		restoreDeliveryEvidence();
		finishWorkers();
		const current = yield* fleet.reconcile("two");
		const decision = current.value.decision?.id ?? "missing";
		yield* fleet.resolve("two", decision, respond(decision, "release"));
		expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
	},
);
engine.it(
	"a PR that no longer has valid delivery evidence does not expire its area hold",
	[deliveryEvidenceCanDisappear()],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, movePullRequestHead, advanceTime, currentTime }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		movePullRequestHead("moved-head");
		advanceTime(1000 - currentTime());
		expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBeUndefined();
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
	},
);
