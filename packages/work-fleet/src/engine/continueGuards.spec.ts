import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";
import { twoSubmissionsOfQuota } from "#test/twoSubmissionsOfQuota.ts";

isolatedEngine.it(
	"continuation refuses a missing worker receipt and an empty message",
	[],
	function* ({ providerOperationCount, editWork, prepareWork, fleet }) {
		yield* prepareWork("one");
		editWork("one", "changed-board");
		expect((yield* fleet.dispatch("one")).value.step).toBe("waiting");
		expect(yield* fleet.continue("one", " \n").pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
		expect(yield* fleet.continue("one", "No worker").pipe(Effect.flip)).toMatchObject({ message: "Continue requires an existing worker receipt" });
		expect(providerOperationCount()).toBe(0);
	},
);

isolatedEngine.it(
	"continuation confirms that the worker still exists and is terminal",
	[noChangeReported()],
	function* ({ setObservedExecution, providerOperationCount, failNextObservation, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const turnId = dispatched.value.attempts[0]?.receipt?.turnId ?? "missing";
		failNextObservation(turnId);
		expect(yield* fleet.continue("one", "Thread unavailable").pipe(Effect.flip)).toMatchObject({ reason: "unavailable" });
		setObservedExecution(turnId, "running");
		expect(yield* fleet.continue("one", "Provider still running").pipe(Effect.flip)).toMatchObject({
			message: "The existing worker turn is still running",
		});
		expect(providerOperationCount()).toBe(2);
	},
);

isolatedEngine.it(
	"continuation keeps quota accounting for archived attempts",
	[twoSubmissionsOfQuota],
	function* ({ providerOperationCount, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		expect(yield* fleet.continue("one", "Over quota").pipe(Effect.flip)).toMatchObject({ message: "Fresh available provider quota is required" });
		expect((yield* fleet.get("one")).value.step).toBe("done");
		expect(providerOperationCount()).toBe(2);
	},
);

isolatedEngine.it(
	"a rejected continued turn preserves its thread for the next manual instruction",
	[noChangeReported()],
	function* ({ rejectNextTurn, launches, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		rejectNextTurn();
		const rejected = yield* fleet.continue("one", "Rejected instruction");
		expect(rejected.value.step).toBe("waiting");
		expect(rejected.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
		expect(rejected.value.attempts[0]?.status).toBe("failed");
		const retried = yield* fleet.continue("one", "Accepted instruction");
		expect(retried.value.step).toBe("working");
		expect(retried.value.attempts[0]?.receipt?.sessionId).toBe("session-operation-1");
		expect(launches()).toHaveLength(2);
	},
);
