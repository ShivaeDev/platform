import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { workerTurnDisappears } from "#test/workerTurnDisappears.ts";

for (const status of ["done", "superseded", "deferred"]) {
	for (const lostAcknowledgement of [false, true]) {
		{
			const setup = workerTurnDisappears(lostAcknowledgement);
			engine.it(
				`a legacy lost turn with ${lostAcknowledgement ? "a missing" : "a recorded"} receipt releases when its Board status is ${status}`,
				[setup.given],
				function* ({ fixture, fleet, prepareWork, restart }) {
					const context = setup.context();
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					const waiting = yield* fleet.reconcile("one");
					expect(waiting.value.decision?.reason).toContain(lostAcknowledgement ? "No matching accepted turn" : "not observable");
					expect(executing(waiting.value)).toBe(true);
					if (waiting.value.decision !== undefined) {
						yield* fixture.replaceRecord({
							...waiting.value,
							decision: { ...waiting.value.decision, code: "session-ambiguous", reason: "Legacy missing-turn decision" },
						});
					}
					fixture.boardStatus("one", status);
					const released = yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
					expect(released.value.stage).toBe("released");
					expect(released.value.releaseReason).toBe(`Board status is ${status}`);
					expect(released.value.outcome).toBeUndefined();
					expect(released.value.decision).toBeUndefined();
					expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: waiting.value.decision?.published }]);
					expect(executing(released.value)).toBe(false);
					expect(released.value.attempts[0]).toMatchObject({ sessionUnusable: true, status: "failed" });
					expect(released.value.attempts[0]?.receipt).toEqual(waiting.value.attempts[0]?.receipt);
					expect((yield* fleet.reconcile("one")).version).toBe(released.version);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
					expect(context.missing.requests).not.toContain("turn/start");
					expect(context.missing.recoveries.slice(1).every((input) => input.resume === undefined)).toBe(true);
				},
			);
		}
	}
}

engine.it(
	"a closed Board item retains ownership while its turn runs and releases once terminal",
	[],
	function* ({ fixture, fleet, prepareWork, finishWorkers, askWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const waiting = (yield* askWorker()).stopped;
		yield* fixture.replaceRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "running" })) });
		const receipt = waiting.value.attempts[0]?.receipt ?? (yield* Effect.die("Missing worker receipt"));
		fixture.observations.set(receipt.turnId, { execution: "running", output: "", provisioning: "ready", receipt });
		fixture.boardStatus("one", "done");
		expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("released");
	},
);
