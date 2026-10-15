import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";
import { postgresTests } from "#test/postgres.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const status of ["done", "superseded", "deferred"]) {
	for (const lostAcknowledgement of [false, true]) {
		test(`a lost turn with ${lostAcknowledgement ? "a missing" : "a recorded"} receipt releases when its Board status is ${status}`, () => {
			const missing = missingTurnTransport();
			return withEngine({ decorateTransport: missing.decorate, lostAcknowledgement }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
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
					const released = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
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
					expect(missing.requests).not.toContain("turn/start");
					expect(missing.recoveries.slice(1).every((input) => input.resume === undefined)).toBe(true);
				}),
			);
		});
	}
}

test("a closed Board item retains ownership while its turn runs and releases once terminal", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			const waiting = (yield* askWorker(fixture)).stopped;
			yield* fixture.replaceRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "running" })) });
			const receipt = waiting.value.attempts[0]?.receipt ?? (yield* Effect.die("Missing worker receipt"));
			fixture.observations.set(receipt.turnId, { execution: "running", output: "", provisioning: "ready", receipt });
			fixture.boardStatus("one", "done");
			expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("released");
		}),
	));
