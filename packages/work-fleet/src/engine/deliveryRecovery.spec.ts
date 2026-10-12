import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

describe("Fleet delivery ownership", () => {
	const test = postgresTests("test");
	test("failed delivery observation retains ownership and recovers without a human retry", () =>
		withEngine({ deliveryFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ambiguous = yield* fleet.reconcile("one");
				expect(ambiguous.value.stage).toBe("needs-human");
				expect(ambiguous.value.decision?.reason).toContain("observation unavailable");
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.merged).toHaveLength(1);
				expect(fixture.reviews).toHaveLength(1);
			}),
		));
	test("safe local release keeps the adopted PR in the foreign backlog without blocking its paths", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				yield* fleet.resolve("one", denied.value.decision?.id ?? "missing", fixture.respond(denied.value.decision?.id ?? "missing", "release"));
				expect(yield* fixture.foreignReservations()).toEqual([{ backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
				yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Same scope", workId: "two" });
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
