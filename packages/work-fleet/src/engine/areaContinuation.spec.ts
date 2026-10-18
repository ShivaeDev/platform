import { Effect } from "effect";
import { expect } from "vitest";
import { continuedWorkHasExpiredAreas } from "#test/continuedWorkHasExpiredAreas.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"continuing completed work reacquires areas even when the old attempts move to history",
	[noChangeReported()],
	function* ({ fixture, fleet, prepareWork, finishWorkers }) {
		fixture.areas("one", ["fleet/host"]);
		fixture.areas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		expect(yield* fleet.continue("one", "Check the follow-up").pipe(Effect.flip)).toMatchObject({
			message: "waiting for area fleet/host held by two",
		});
		expect((yield* fleet.get("one")).value.stage).toBe("completed");
		expect(fixture.operations.size).toBe(3);
		finishWorkers();
		yield* fleet.reconcile("two");
		const continued = yield* fleet.continue("one", "Check the follow-up");
		expect(continued.value.stage).toBe("executing");
		expect(continued.value.attempts).toHaveLength(1);
		expect(continued.value.history?.[0]?.attempts).toHaveLength(2);
		expect(continued.value.attempts[0]?.receipt?.sessionId).toBe("session-operation-1");
	},
);

{
	const setup = continuedWorkHasExpiredAreas();
	engine.it(
		"continuing a PR after its merge wait must reacquire the area and clear the old timer",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, respond }) {
			const context = setup.context();
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(100);
			context.now += 5000;
			yield* fleet.dispatch("two");
			expect(yield* fleet.continue("one", "Revise the PR").pipe(Effect.flip)).toMatchObject({ message: "waiting for area fleet/host held by two" });
			expect(fixture.operations.size).toBe(3);
			finishWorkers();
			const holder = yield* fleet.reconcile("two");
			const decision = holder.value.decision?.id ?? "missing";
			yield* fleet.resolve("two", decision, respond(decision, "release"));
			const continued = yield* fleet.continue("one", "Revise the PR");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.mergeReadyAt).toBeUndefined();
			expect(continued.value.mergeAreasReleased).toBeUndefined();
			expect(continued.value.history?.[0]?.mergeReadyAt).toBe(100);
		},
	);
}
