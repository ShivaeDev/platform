import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { prepared } from "#test/preparation.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("Fleet delivery ownership", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("lost delivery acknowledgement retains ownership and adopts the actual merged PR", () =>
		withEngine({ deliveryFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ambiguous = yield* fleet.reconcile("one");
				expect(ambiguous.value.stage).toBe("needs-human");
				expect(ambiguous.value.deliverySubmitted).toBe(true);
				const decisionId = ambiguous.value.decision?.id ?? "missing";
				expect(yield* Effect.flip(fleet.resolve("one", decisionId, fixture.respond(decisionId, "release")))).toMatchObject({ _tag: "FleetFailure" });
				yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.merged).toHaveLength(1);
				expect(fixture.reviews).toHaveLength(1);
			}),
		));
	test("safe local release preserves the adopted PR's actual scope as foreign ownership", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				yield* fleet.resolve("one", denied.value.decision?.id ?? "missing", fixture.respond(denied.value.decision?.id ?? "missing", "release"));
				const overlap = fleet.prepare({
					cwd: "/synthetic",
					preparation: prepared({ ownedPaths: ["src/one.ts"] }),
					prompt: "Overlapping work",
					workId: "two",
				});
				expect(yield* Effect.flip(overlap)).toMatchObject({ _tag: "StorageOwnershipConflict", owner: "https://example.invalid/pr/one" });
				yield* prepareWork("two");
				expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
			}),
		));
	test("duplicate operation identity cannot acknowledge the wrong work's turn", () =>
		withEngine({ operationCollision: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				yield* fleet.dispatch("two");
				expect((yield* fleet.get("two")).value.attempts[0]?.receipt).toBeUndefined();
				expect(fixture.operations.size).toBe(1);
			}),
		));
	test("persisted acknowledgement rejects a replacement session or turn identity", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const submitted = yield* fleet.dispatch("one");
				const attempt = submitted.value.attempts[0];
				expect(attempt).toBeDefined();
				expect(
					yield* Effect.flip(fixture.acknowledgeTurn(attempt?.operationId ?? "missing", { sessionId: "another-session", turnId: "another-turn" })),
				).toMatchObject({ _tag: "SessionFailure", reason: "persistence" });
				expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(attempt?.receipt);
			}),
		));
});
