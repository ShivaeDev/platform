import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("continuing work waiting on a human merge retains the reviewed head and worker thread without replay", () =>
	withEngine({ denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			const first = yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.stage).toBe("needs-human");
			expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			expect(ready.value.review?.head).toBe(ready.value.result?.head);
			expect(ready.value.checks).toMatchObject({ head: ready.value.result?.head, passed: true });
			const continued = yield* fleet.continue("one", "Change again");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.result).toEqual(ready.value.result);
			expect(continued.value.history?.[0]?.review).toEqual(ready.value.review);
			expect(continued.value.attempts[0]).toMatchObject({
				prompt: "Change again",
				receipt: { sessionId: first.value.attempts[0]?.receipt?.sessionId, turnId: "turn-operation-3" },
			});
			expect(continued.value.review).toBeUndefined();
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const observed = yield* restarted.reconcile("one");
					expect(observed.value.result).toEqual(ready.value.result);
					expect(observed.value.history?.[0]?.review).toEqual(ready.value.review);
					expect(observed.value.attempts).toHaveLength(1);
					expect(observed.value.attempts[0]?.receipt).toEqual(continued.value.attempts[0]?.receipt);
					expect((yield* restarted.reconcile("one")).value.attempts[0]?.receipt).toEqual(observed.value.attempts[0]?.receipt);
				}),
			);
			expect(fixture.operations.size).toBe(3);
			expect(fixture.settings.filter((call) => call.call === "turn").map((call) => call.operationId)).toEqual([
				"operation-1",
				"operation-2",
				"operation-3",
			]);
			expect(fixture.launched).toHaveLength(2);
			expect(fixture.merged).toEqual([]);
		}),
	));

test("continuation retains the unresolved PR's backlog until the new result is adopted", () =>
	withEngine({ denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const stopped = yield* fleet.reconcile("one");
			const continued = yield* fleet.continue("one", "Repair the PR");
			expect(backlog(continued.value)).toBe(true);
			expect(continued.value.result).toEqual(stopped.value.result);
			finishWorkers(fixture);
			const adopted = yield* fleet.reconcile("one");
			expect(adopted.value.result?.head).not.toBe(stopped.value.result?.head);
		}),
	));

test("continuation does not use an archived worker from a different thread after renewal", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			fixture.editWork("one", "renewed-board");
			fixture.approveWork("one", "renewed-board");
			yield* prepareWork("one");
			fixture.rejectNextTurn();
			expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
			expect(yield* fleet.continue("one", "Keep the current thread").pipe(Effect.flip)).toMatchObject({
				message: "Continue requires an existing worker receipt",
			});
			expect(fixture.operations.size).toBe(2);
		}),
	));
