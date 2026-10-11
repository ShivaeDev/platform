import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("continuation retains an unresolved prior merge submission instead of starting new execution", () =>
	withEngine({ denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			yield* fixture.markLegacyDeliverySubmitted("one");
			const stopped = yield* fleet.get("one");
			expect(stopped.value.stage).toBe("needs-human");
			expect(yield* fleet.continue("one", "Change again").pipe(Effect.flip)).toMatchObject({
				message: "Reconcile the submitted delivery before continuing",
			});
			expect((yield* fleet.get("one")).value).toEqual(stopped.value);
			expect(fixture.operations.size).toBe(2);
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
