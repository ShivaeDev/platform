import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { humanMergeCanArriveLate, mergeWaitIsFiveSeconds, reviewOutlivesMergeWait } from "#test/areaMergeWaitScenarios.ts";
import { engine } from "#test/engineStory.ts";

{
	const setup = humanMergeCanArriveLate();
	engine.it(
		"the default merge wait frees areas after thirty minutes and continues observing delivery across restart",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value).toMatchObject({
				attentionOwner: "maintainer",
				decision: { attentionOwner: "maintainer" },
				mergeReadyAt: 100,
				mergeReadyHead: "head-one-0",
				stage: "needs-human",
			});
			context.now += 1_800_000 - 1;
			yield* fleet.reconcile("one");
			expect((yield* fleet.get("one")).value.mergeReadyAt).toBe(100);
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			context.now += 1;
			yield* restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					expect((yield* restarted.dispatch("two")).value.stage).toBe("executing");
					expect((yield* restarted.get("one")).value).toMatchObject({
						attentionOwner: "maintainer",
						decision: { attentionOwner: "maintainer" },
						stage: "needs-human",
					});
					context.merged = true;
					expect((yield* restarted.reconcile("one")).value).toMatchObject({ outcome: { revision: "merged" }, stage: "completed" });
				}),
			);
		},
	);
}

{
	const setup = mergeWaitIsFiveSeconds();
	engine.it(
		"a configured merge wait uses readiness time rather than worker start time",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			context.now = 20_000;
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(20_000);
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			context.now += 5000;
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		},
	);
}

{
	const setup = reviewOutlivesMergeWait();
	engine.it(
		"a worker or unfinished review holds its area regardless of elapsed time",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			context.now = 20_000;
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
}
