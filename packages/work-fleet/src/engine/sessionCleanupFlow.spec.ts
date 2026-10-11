import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

describe("Fleet session cleanup", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("retains a stopped worker question and its continued thread until completion", () =>
		withFleetBoard({}, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision, stopped } = yield* askWorker(fixture);
				expect(stopped.value.stage).toBe("needs-human");
				expect(fixture.archived).toEqual([]);
				const answer = yield* answerWorker(root, decision);
				const continued = yield* fleet.resolve("one", decision.id, answer.id);
				expect(continued.value.stage).toBe("executing");
				expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(decision.worker?.sessionId);
				expect(fixture.archived).toEqual([]);
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.archived).toHaveLength(2);
				expect(fixture.archived.filter((id) => id === decision.worker?.sessionId)).toHaveLength(1);
			}),
		));
	for (const noChange of [false, true]) {
		test(`archives worker and reviewer threads after ${noChange ? "no-change" : "delivery"} completion`, () =>
			withEngine({ noChange }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					expect(fixture.archived).toEqual([]);
					finishWorkers(fixture);
					const completed = yield* fleet.reconcile("one");
					expect(completed.value.stage).toBe("completed");
					expect(fixture.archived).toEqual(completed.value.attempts.map((attempt) => attempt.receipt?.sessionId));
					expect(pendingSessionCleanup(completed.value)).toEqual([]);
					yield* fixture.restart(fleet.reconcile("one"));
					expect(fixture.archived).toHaveLength(2);
				}),
			));
	}
	test("keeps every thread while review or check repair can need the original conversation", () =>
		withEngine({ checkRepair: true, checksFailure: true, repairs: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewRepair = yield* fleet.reconcile("one");
				expect(reviewRepair.value.attempts.at(-1)?.role).toBe("repair");
				expect(fixture.archived).toEqual([]);
				finishWorkers(fixture);
				const checkRepair = yield* fleet.reconcile("one");
				expect(checkRepair.value.attempts.at(-1)?.role).toBe("repair");
				expect(fixture.archived).toEqual([]);
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(fixture.archived).toEqual([...new Set(completed.value.attempts.map((attempt) => attempt.receipt?.sessionId))]);
			}),
		));
	test("keeps needs-human threads until an explicit safe release", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				expect(fixture.archived).toEqual([]);
				const decisionId = denied.value.decision?.id ?? "missing";
				const response = fixture.respond(decisionId, "release");
				expect((yield* fleet.resolve("one", decisionId, response)).value.stage).toBe("released");
				expect(fixture.archived).toHaveLength(2);
				yield* fleet.resolve("one", decisionId, response);
				expect(fixture.archived).toHaveLength(2);
			}),
		));
	test("archive failure preserves completion and retries after a host restart without repeating delivery", () =>
		withEngine({ archiveFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(pendingSessionCleanup(completed.value)).toHaveLength(1);
				expect(fixture.archived).toHaveLength(1);
				yield* fixture.restart(cycle);
				expect(pendingSessionCleanup((yield* fleet.get("one")).value)).toEqual([]);
				expect(fixture.archived).toHaveLength(2);
				expect(fixture.merged).toHaveLength(1);
			}),
		));
	test("cleans up a retained session whose first turn was rejected on release", () =>
		withEngine({ rejectTurn: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const rejected = yield* fleet.dispatch("one");
				expect(rejected.value.attempts[0]?.receipt).toBeUndefined();
				const decisionId = rejected.value.decision?.id ?? "missing";
				yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "release"));
				expect(fixture.archived).toEqual([rejected.value.attempts[0]?.sessionId]);
			}),
		));
	test("retries prior cleanup after renewal without archiving the new worker", () =>
		withEngine({ archiveFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				expect(fixture.archived).toHaveLength(1);
				fixture.editWork("one", "next-revision");
				fixture.approveWork("one", "next-revision");
				const renewed = yield* prepareWork("one");
				expect(renewed.value.stage).toBe("prepared");
				expect(pendingSessionCleanup(renewed.value)).toEqual([]);
				expect(fixture.archived).toHaveLength(2);
				yield* fleet.dispatch("one");
				yield* fleet.reconcile("one");
				expect(fixture.archived).toHaveLength(2);
			}),
		));
});
