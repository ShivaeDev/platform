import { Effect } from "effect";
import { expect } from "vitest";
import { continuedWorkHasExpiredAreas } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"continuing completed work reacquires areas even when the old attempts move to history",
	[noChangeReported()],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, providerOperationCount }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
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
		expect(providerOperationCount()).toBe(3);
		finishWorkers();
		yield* fleet.reconcile("two");
		const continued = yield* fleet.continue("one", "Check the follow-up");
		expect(continued.value.stage).toBe("executing");
		expect(continued.value.attempts).toHaveLength(1);
		expect(continued.value.history?.[0]?.attempts).toHaveLength(2);
		expect(continued.value.attempts[0]?.receipt?.sessionId).toBe("session-operation-1");
	},
);
engine.it(
	"continuing a PR after its merge wait must reacquire the area and clear the old timer",
	[continuedWorkHasExpiredAreas()],
	function* ({ fleet, prepareWork, finishWorkers, respond, setAreas, advanceTime, providerOperationCount }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(100);
		advanceTime(5000);
		yield* fleet.dispatch("two");
		expect(yield* fleet.continue("one", "Revise the PR").pipe(Effect.flip)).toMatchObject({ message: "waiting for area fleet/host held by two" });
		expect(providerOperationCount()).toBe(3);
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
