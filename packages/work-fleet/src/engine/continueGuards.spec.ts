import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";
import { refusal } from "#test/refusal.ts";
import { twoSubmissionsOfQuotaConfiguration } from "#test/twoSubmissionsOfQuotaConfiguration.ts";

const twoSubmissionsOfQuota = engineConfiguration("two submissions of quota", twoSubmissionsOfQuotaConfiguration());

isolatedEngine.it(
	"continuation refuses a missing worker receipt and an empty message",
	[],
	function* ({ providerOperations, editWork, prepareWork, fleet }) {
		yield* prepareWork("one");
		editWork("one", "changed-board");
		const dispatched2 = yield* fleet.dispatch("one");
		expect(dispatched2.value.step).toBe("waiting");
		const continuedOutcome = yield* refusal(fleet.continue("one", " \n"));
		expect(continuedOutcome).toMatch(/^bad request: /u);
		const continued = yield* fleet.continue("one", "No worker").pipe(Effect.flip);
		expect(continued).toMatchObject({ message: "Continue requires an existing worker receipt" });
		expect(providerOperations()).toEqual([]);
	},
);

isolatedEngine.it(
	"continuation confirms that the worker still exists and is terminal",
	[noChangeReported()],
	function* ({ setObservedExecution, providerOperations, failNextObservation, finishWorkers, prepareWork, fleet }) {
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
		expect(providerOperations()).toEqual(["operation-1", "operation-2"]);
	},
);

isolatedEngine.it(
	"continuation keeps quota accounting for archived attempts",
	[twoSubmissionsOfQuota],
	function* ({ providerOperations, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const continued2 = yield* fleet.continue("one", "Over quota").pipe(Effect.flip);
		expect(continued2).toMatchObject({ message: "Fresh available provider quota is required" });
		expect((yield* fleet.get("one")).value.step).toBe("done");
		expect(providerOperations()).toEqual(["operation-1", "operation-2"]);
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
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);
