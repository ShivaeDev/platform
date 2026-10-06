import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("Fleet completion path", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("independently reviews, checks and delivers the exact adopted head", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.review?.receipt.sessionId).not.toBe(completed.value.attempts[0]?.receipt?.sessionId);
				expect(completed.value.checks?.head).toBe(completed.value.review?.head);
				expect(fixture.merged).toEqual([completed.value.review?.head]);
			}),
		));
	test("repairs continue the original conversation and require fresh head review and checks", () =>
		withEngine({ repairs: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const repair = yield* fleet.reconcile("one");
				expect(repair.value.attempts.at(-1)?.role).toBe("repair");
				expect(repair.value.attempts.at(-1)?.receipt?.sessionId).toBe(repair.value.attempts[0]?.receipt?.sessionId);
				finishWorkers(fixture);
				const complete = yield* fleet.reconcile("one");
				expect(complete.value.stage).toBe("completed");
				expect(fixture.reviews).toEqual(["head-one-0", "head-one-1"]);
				expect(complete.value.checks?.head).toBe("head-one-1");
			}),
		));
	test("denied delivery persists an actionable decision and keeps ownership", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				expect(denied.value.stage).toBe("needs-human");
				expect(denied.value.decision?.reason).toContain("denies delivery");
				expect(fixture.merged).toHaveLength(0);
				const decisionId = denied.value.decision?.id ?? "missing";
				expect((yield* fleet.resolve("one", decisionId, "retry")).value.stage).toBe("reviewing");
				expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	test("accepts no-change at its actual head after independent review and required checks", () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.checks?.head).toBe("current-main");
				expect(completed.value.outcome).toMatchObject({ evidence: [expect.any(String)] });
				expect(fixture.merged).toHaveLength(0);
			}),
		));
	for (const wrongHead of ["review", "checks"] as const) {
		test(`rejects ${wrongHead} evidence for a different head`, () =>
			withEngine({ wrongHead }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
					expect(fixture.merged).toHaveLength(0);
				}),
			));
	}
	test("rejects review by the original worker conversation", () =>
		withEngine({ sameReviewer: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const rejected = yield* fleet.reconcile("one");
				expect(rejected.value.decision?.reason).toContain("Independent review");
				expect(fixture.merged).toHaveLength(0);
			}),
		));
	test("a reviewer verdict cannot free its slot until the exact turn is terminal", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.attempts.at(-1)?.status).toBe("running");
				expect(fixture.merged).toHaveLength(0);
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.reviews).toHaveLength(1);
			}),
		));
});
