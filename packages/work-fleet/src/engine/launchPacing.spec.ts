import { describe, expect } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live", "isolated");

describe("Fleet launch acknowledgement pacing", () => {
	test("a slow thread acknowledgement is persisted after the pass, without concurrent recovery", function* () {
		const acknowledgement = yield* Deferred.make<void>();
		yield* withEngine({ sessionAcknowledgementGate: Deferred.await(acknowledgement) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				expect((yield* cycle.pipe(Effect.timeout("3 seconds"))).dispatched).toHaveLength(2);
				yield* cycle.pipe(Effect.timeout("3 seconds"));
				expect(fixture.decisions).toEqual([]);
				yield* Deferred.succeed(acknowledgement, undefined);
				yield* Effect.gen(function* () {
					while ((yield* fleet.get("one")).value.attempts[0]?.receipt === undefined) {
						yield* Effect.yieldNow;
					}
				}).pipe(Effect.timeout("3 seconds"));
				expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(fixture.operations.get("operation-1"));
				expect(fixture.launched).toEqual(["operation-1", "operation-2"]);
			}),
		);
	});
	for (const acknowledgement of ["session", "turn"] as const) {
		test(`a lost ${acknowledgement} acknowledgement allows the next launch in the same pass`, () =>
			withEngine(
				acknowledgement === "turn" ? { acknowledgementGate: Effect.never, lostAcknowledgement: true } : { sessionAcknowledgementGate: Effect.never },
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						yield* prepareWork("two");
						const fleet = yield* Fleet;
						const pass = yield* cycle.pipe(Effect.timeout("3 seconds"));
						expect(pass.dispatched).toHaveLength(2);
						const pending = (yield* fleet.get("one")).value;
						expect(pending.attempts[0]).toMatchObject({ operationId: "operation-1", status: "submitting" });
						expect(pending.attempts[0]?.receipt).toBeUndefined();
						expect(executing(pending)).toBe(true);
						expect((yield* fleet.get("two")).value.attempts[0]?.receipt).toBeDefined();
						expect(fixture.decisions).toEqual([]);
						yield* fixture.restart(cycle);
						const recovered = (yield* fleet.get("one")).value;
						if (acknowledgement === "turn") {
							expect(recovered.attempts[0]?.receipt).toEqual(fixture.operations.get("operation-1"));
							expect(recovered.attempts[0]?.status).toBe("running");
						}
						expect(recovered.attempts).toHaveLength(1);
						expect(executing(recovered)).toBe(true);
						expect(fixture.launched).toEqual(["operation-1", "operation-2"]);
					}),
			));
	}
	test("an explicit capacity rejection after a lost acknowledgement stops the rest of the pass", () => {
		let turns = 0;
		return withEngine(
			{
				acknowledgementGate: Effect.never,
				backlog: 3,
				concurrency: 3,
				lostAcknowledgement: true,
				submissionFailure: (call) => {
					if (call === "turn") {
						turns += 1;
					}
					return call === "turn" && turns === 2 ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined;
				},
			},
			(fixture) =>
				Effect.gen(function* () {
					fixture.dependencies("dependent", []);
					for (const id of ["one", "two", "dependent"]) {
						yield* prepareWork(id);
					}
					const fleet = yield* Fleet;
					expect((yield* cycle.pipe(Effect.timeout("3 seconds"))).dispatched).toHaveLength(2);
					expect((yield* fleet.get("two")).value.launchRetry).toBeDefined();
					expect((yield* fleet.get("dependent")).value.attempts).toEqual([]);
					expect(fixture.launched).toEqual(["operation-1", "operation-2"]);
				}),
		);
	});
	test("a capacity rejection from a background launch stops later dispatch", () =>
		withEngine(
			{
				acknowledgementGate: Effect.never,
				backlog: 3,
				concurrency: 3,
				lostAcknowledgement: true,
				sessionAcknowledgementGate: Effect.sleep("1500 millis").pipe(
					Effect.andThen(Effect.fail(new SessionFailure({ message: "Request queue is full", reason: "rejected" }))),
				),
			},
			(fixture) =>
				Effect.gen(function* () {
					fixture.dependencies("dependent", []);
					for (const id of ["one", "two", "dependent"]) {
						yield* prepareWork(id);
					}
					const fleet = yield* Fleet;
					expect((yield* cycle.pipe(Effect.timeout("5 seconds"))).dispatched).toHaveLength(2);
					expect((yield* fleet.get("one")).value.launchRetry).toBeDefined();
					expect((yield* fleet.get("dependent")).value.attempts).toEqual([]);
					expect(fixture.launched).toEqual(["operation-1", "operation-2"]);
				}),
		));
	test("a human retry reuses the thread whose first turn was rejected", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				fixture.rejectNextTurn();
				const rejected = (yield* fleet.dispatch("one")).value;
				const decisionId = rejected.decision?.id ?? "missing";
				yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
				yield* fixture.restart(cycle);
				const accepted = (yield* fleet.get("one")).value;
				expect(accepted.attempts).toHaveLength(2);
				expect(accepted.attempts.at(-1)?.receipt).toEqual({ sessionId: rejected.attempts[0]?.sessionId, turnId: "turn-operation-2" });
				expect(fixture.launched).toEqual(["operation-1"]);
			}),
		));
});
