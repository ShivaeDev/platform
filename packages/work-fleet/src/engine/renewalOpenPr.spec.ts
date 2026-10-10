import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { FleetFailure, type WorkResult } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const original: WorkResult = { head: "head-one", kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" };
describe("renewal refreshes adopted open PR ownership", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("changed actual scope remains reserved when renewal is denied", () => {
		let result = original;
		return withEngine({ denyDelivery: true, resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.result).toEqual(original);
				result = { ...original, paths: ["src/one.ts", "src/two.ts"] };
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ message: expect.stringContaining("scope exceeds"), reason: "denied" });
				expect((yield* fleet.get("one")).value.history).toBeUndefined();
				expect(yield* Effect.flip(prepareWork("two"))).toMatchObject({ _tag: "StorageOwnershipConflict" });
				expect(fixture.launched).toHaveLength(2);
			}),
		);
	});
	test("unknown actual PR ownership retains the previous cycle", () => {
		let unavailable = false;
		return withEngine(
			{
				denyDelivery: true,
				resultQuery: () =>
					unavailable ? Effect.fail(new FleetFailure({ message: "Ownership unavailable", reason: "integration" })) : Effect.succeed(original),
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					yield* fleet.reconcile("one");
					unavailable = true;
					fixture.editWork("one", "board-one-next");
					fixture.approveWork("one", "board-one-next");
					expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({
						message: expect.stringContaining("ownership is unavailable"),
						reason: "denied",
					});
					const retained = yield* fleet.get("one");
					expect(retained.value.result).toEqual(original);
					expect(retained.value.history).toBeUndefined();
					expect(retained.value.boardRevision).toBe("board-one");
				}),
		);
	});
	test("a different observed PR retains both known owners without archiving", () => {
		let result = original;
		return withEngine({ denyDelivery: true, resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				result = { ...original, paths: ["src/two.ts"], pr: "https://example.invalid/pr/replacement" };
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ message: expect.stringContaining("identity changed"), reason: "denied" });
				expect((yield* fleet.get("one")).value.result).toEqual(original);
				expect(yield* Effect.flip(prepareWork("two"))).toMatchObject({ _tag: "StorageOwnershipConflict" });
			}),
		);
	});
	test("a refreshed head is archived with prior evidence instead of reusing it for new work", () => {
		let result = original;
		return withEngine({ denyDelivery: true, resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				result = { ...original, head: "head-updated" };
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				const renewed = yield* prepareWork("one");
				expect(renewed.value.history?.[0]?.result).toEqual(result);
				expect(renewed.value.history?.[0]?.resultObservations).toEqual([original]);
				expect(renewed.value.history?.[0]?.review?.head).toBe("head-one");
				expect(renewed.value.review).toBeUndefined();
				expect(renewed.value.checks).toBeUndefined();
				expect(renewed.value.result).toBeUndefined();
			}),
		);
	});
	test("guided release cannot shrink a previously observed expanded PR reservation", () => {
		let result = original;
		return withEngine({ denyDelivery: true, resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				result = { ...original, paths: ["src/one.ts", "src/two.ts"] };
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ reason: "denied" });
				const decisionId = denied.value.decision?.id ?? "missing";
				const responseId = fixture.respond(decisionId, "release");
				expect((yield* fleet.resolve("one", decisionId, responseId)).value.stage).toBe("released");
				expect(yield* Effect.flip(prepareWork("two"))).toMatchObject({ _tag: "StorageOwnershipConflict" });
			}),
		);
	});
});
