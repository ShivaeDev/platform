import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

describe("Fleet recovery", () => {
	const test = postgresTests("test");
	test("rebuilding services adopts a lost turn acknowledgement without duplicate launch or human action", () =>
		withEngine({ lostAcknowledgement: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const intent = yield* fleet.dispatch("one");
				expect(intent.value.step).toBe("working");
				expect(intent.value.attempts[0]?.receipt).toBeUndefined();
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const adopted = yield* restarted.reconcile("one");
						expect(adopted.value.attempts[0]?.receipt?.turnId).toBe("turn-operation-1");
					}),
				);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.decisions).toHaveLength(0);
			}),
		));
	test("review retry reconciles the submitted reviewer instead of starting another session", () =>
		withEngine({ reviewFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const failed = yield* fleet.reconcile("one");
				expect(failed.value.step).toBe("waiting");
				expect(failed.value.attempts.at(-1)?.role).toBe("reviewer");
				yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", fixture.respond(failed.value.decision?.id ?? "missing", "retry"));
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	test("durable Board question publication retries after failure", () =>
		withEngine({ denyDelivery: true, publishFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const failed = yield* fleet.reconcile("one");
				expect(failed.value.decisionPublished).toBe(false);
				expect(fixture.decisions).toHaveLength(0);
				expect((yield* fleet.reconcile("one")).value.decisionPublished).toBe(true);
				expect(fixture.decisions).toHaveLength(1);
			}),
		));
	test("no-change validation retry keeps original worker and reviewer", () =>
		withEngine({ checksFailure: true, noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const failed = yield* fleet.reconcile("one");
				expect(failed.value.step).toBe("waiting");
				yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", fixture.respond(failed.value.decision?.id ?? "missing", "retry"));
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	test("required checks with scoped guidance repair automatically and revalidate the new head", () =>
		withEngine({ checkRepair: true, checksFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const repair = yield* fleet.reconcile("one");
				expect(repair.value.step).toBe("working");
				expect(repair.value.checks?.passed).toBe(false);
				expect(fixture.decisions).toHaveLength(0);
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.step).toBe("done");
				expect(completed.value.checks?.head).toBe("head-one-1");
				expect(fixture.reviews).toHaveLength(2);
			}),
		));
	test("cached running reviewer retries its exact observation after failure", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const receipt = reviewing.value.attempts.at(-1)?.receipt;
				fixture.failedObservations.add(receipt?.turnId ?? "missing");
				const failed = yield* fleet.reconcile("one");
				expect(failed.value.step).toBe("waiting");
				yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", fixture.respond(failed.value.decision?.id ?? "missing", "retry"));
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
});
