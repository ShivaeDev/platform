import { Effect } from "effect";
import { expect } from "vitest";
import { continuedWorkHasExpiredAreas } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"continuing done work reacquires areas even when the old attempts move to history",
	[noChangeReported()],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, providerOperations }) {
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
		expect((yield* fleet.get("one")).value.step).toBe("done");
		expect(providerOperations()).toEqual(["operation-1", "operation-2", "operation-3"]);
		finishWorkers();
		yield* fleet.reconcile("two");
		const continued = yield* fleet.continue("one", "Check the follow-up");
		expect(continued.value.step).toBe("working");
		expect(continued.value.attempts).toMatchObject([{ operationId: "operation-6", receipt: { sessionId: "session-operation-1" } }]);
		expect(continued.value.history?.[0]?.attempts.map(({ operationId }) => operationId)).toEqual(["operation-1", "operation-2"]);
	},
);
engine.it(
	"continuing a PR after its merge wait must reacquire the area and clear the old timer",
	[continuedWorkHasExpiredAreas()],
	function* ({ fleet, prepareWork, finishWorkers, respond, setAreas, advanceTime, currentTime, providerOperations }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const readyAt = currentTime();
		expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(readyAt);
		advanceTime(5000);
		yield* fleet.dispatch("two");
		expect(yield* fleet.continue("one", "Revise the PR").pipe(Effect.flip)).toMatchObject({ message: "waiting for area fleet/host held by two" });
		expect(providerOperations()).toEqual(["operation-1", "operation-2", "operation-3"]);
		finishWorkers();
		const holder = yield* fleet.reconcile("two");
		const decision = holder.value.decision?.id ?? "missing";
		yield* fleet.resolve("two", decision, respond(decision, "release"));
		const continued = yield* fleet.continue("one", "Revise the PR");
		expect(continued.value.step).toBe("working");
		expect(continued.value.mergeReadyAt).toBeUndefined();
		expect(continued.value.mergeAreasReleased).toBeUndefined();
		expect(continued.value.history?.[0]?.mergeReadyAt).toBe(readyAt);
	},
);
