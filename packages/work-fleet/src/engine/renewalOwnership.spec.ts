import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("renewal reconciles prior result ownership", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("a context edit cannot discard an unadopted worker PR's reservation", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				finishWorkers(fixture);
				const stale = yield* fleet.reconcile("one");
				expect(stale.value.result).toBeUndefined();
				const renewed = yield* prepareWork("one");
				expect(renewed.value.history?.[0]?.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
				expect(renewed.value.history?.[0]?.outcome).toBeUndefined();
				expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
				expect(fixture.launched).toHaveLength(1);
				yield* prepareWork("two");
				expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
			}),
		));
	test("unknown terminal result ownership cannot be turned into a new worker", () =>
		withEngine({ resultUnavailable: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const error = yield* Effect.flip(prepareWork("one"));
				expect(error).toMatchObject({ _tag: "FleetFailure", message: expect.stringContaining("ownership is unavailable"), reason: "denied" });
				const retained = yield* fleet.get("one");
				expect(retained.value.history).toBeUndefined();
				expect(retained.value.attempts).toHaveLength(1);
				expect(retained.value.boardRevision).toBe("board-one");
				expect(fixture.launched).toHaveLength(1);
			}),
		));
	test("an observing failure conserves the old attempt and reservation", () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const submitted = yield* fleet.dispatch("one");
				finishWorkers(fixture);
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				yield* fleet.reconcile("one");
				fixture.failedObservations.add(submitted.value.attempts[0]?.receipt?.turnId ?? "missing");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
				expect((yield* fleet.get("one")).value.history).toBeUndefined();
				expect(fixture.launched).toHaveLength(1);
			}),
		));
});
