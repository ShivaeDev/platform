import { Effect } from "effect";
import { expect } from "vitest";
import { deliveryChangesAfterAreaRelease, deliveryEvidenceCanDisappear } from "#test/areaDeliveryObservationScenarios.ts";
import { engine } from "#test/engineStory.ts";

{
	const setup = deliveryChangesAfterAreaRelease();
	engine.it(
		"delivery changes after the merge wait do not reclaim freed areas",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, respond }) {
			const context = setup.context();
			for (const id of ["one", "two", "dependent"]) {
				fixture.dependencies(id, []);
				fixture.areas(id, ["fleet/host"]);
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			context.now += 5000;
			yield* fleet.dispatch("two");
			context.changed = true;
			const previous = yield* fleet.reconcile("one");
			expect(previous.value.mergeAreasReleased).toBe(true);
			expect(previous.value.decision?.reason).toBe("PR closed without merging");
			expect(previous.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			context.changed = false;
			finishWorkers();
			const current = yield* fleet.reconcile("two");
			const decision = current.value.decision?.id ?? "missing";
			yield* fleet.resolve("two", decision, respond(decision, "release"));
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
		},
	);
}

{
	const setup = deliveryEvidenceCanDisappear();
	engine.it(
		"a PR that no longer has valid delivery evidence does not expire its area hold",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			context.changed = true;
			context.now = 1000;
			expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBeUndefined();
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
		},
	);
}
