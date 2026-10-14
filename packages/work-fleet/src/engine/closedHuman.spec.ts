import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const status of ["done", "superseded", "deferred"]) {
	test(`a terminal needs-human item releases when its Board status is ${status}`, () =>
		withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					observe: () =>
						Effect.fail(
							new SessionFailure({ message: "No matching accepted turn is observable; absence does not authorize replay", reason: "ambiguous" }),
						),
				}),
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					const waiting = yield* fleet.reconcile("one");
					expect(waiting.value.decision?.reason).toContain("No matching accepted turn");
					yield* fixture.replaceRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "failed" })) });
					fixture.boardStatus("one", status);
					const released = yield* fleet.reconcile("one");
					expect(released.value.stage).toBe("released");
					expect(released.value.releaseReason).toBe(`Board status is ${status}`);
					expect(released.value.outcome).toBeUndefined();
					expect(released.value.decision).toBeUndefined();
					expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: waiting.value.decision?.published }]);
					expect(executing(released.value)).toBe(false);
					expect((yield* fleet.reconcile("one")).version).toBe(released.version);
				}),
		));
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
