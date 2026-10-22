import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { workerTurnDisappears } from "#test/engineTurnTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const status of ["done", "dropped", "deferred", "dropped"]) {
	for (const lostAcknowledgement of [false, true]) {
		engine.it(
			`a legacy lost turn with ${lostAcknowledgement ? "a missing" : "a recorded"} receipt releases when its Board status is ${status}`,
			[workerTurnDisappears(lostAcknowledgement)],
			function* ({ fleet, prepareWork, restart, replaceStoredRecord, setBoardStatus, providerCalls, providerRequests, providerRecoveries }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const waiting = yield* fleet.reconcile("one");
				expect(waiting.value.decision?.reason).toContain(lostAcknowledgement ? "No matching accepted turn" : "not observable");
				expect(executing(waiting.value)).toBe(true);
				if (waiting.value.decision !== undefined) {
					yield* replaceStoredRecord({
						...waiting.value,
						decision: { ...waiting.value.decision, code: "session-ambiguous", reason: "Legacy missing-turn decision" },
					});
				}
				setBoardStatus("one", status);
				yield* restart();
				const released = yield* fleet.reconcile("one");
				expect(released.value.step).toBe("released");
				expect(released.value.releaseReason).toBe(`Board status is ${status}`);
				expect(released.value.outcome).toBeUndefined();
				expect(released.value.decision).toBeUndefined();
				expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: waiting.value.decision?.published }]);
				expect(executing(released.value)).toBe(false);
				expect(released.value.attempts[0]).toMatchObject({ sessionUnusable: true, status: "failed" });
				expect(released.value.attempts[0]?.receipt).toEqual(waiting.value.attempts[0]?.receipt);
				expect((yield* fleet.reconcile("one")).version).toBe(released.version);
				expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(1);
				expect(providerRequests()).not.toContain("turn/start");
				expect(
					providerRecoveries()
						.slice(1)
						.every((input) => input.resume === undefined),
				).toBe(true);
			},
		);
	}
}
engine.it(
	"a closed Board item retains ownership while its turn runs and releases once terminal",
	[],
	function* ({ fleet, prepareWork, finishWorkers, turnReports, replaceStoredRecord, setTurnExecution, setBoardStatus }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* turnReports(yield* fleet.get("one"), `FLEET_QUESTION: ${QUESTION}`);
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.decision?.published).toBeDefined();
		yield* replaceStoredRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "running" })) });
		const receipt = waiting.value.attempts[0]?.receipt ?? (yield* Effect.die("Missing worker receipt"));
		setTurnExecution(receipt, "running");
		setBoardStatus("one", "done");
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("released");
	},
);
