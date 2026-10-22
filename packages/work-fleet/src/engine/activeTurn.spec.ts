import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { activeTurn } from "#test/activeTurn.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live", "isolated");

test("a follow-up rejected while a steered turn is active waits and continues the same durable attempt", function* () {
	const provider = yield* activeTurn("Another operation owns this thread.");
	let merged = false;
	yield* withEngine(
		{
			decorateTransport: provider.decorateTransport,
			deliveryQuery: (result) => Effect.succeed(merged ? { head: result.head, revision: "merge-commit", url: result.pr } : undefined),
			launch: { effort: "high", model: "synthetic-model" },
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const started = yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				provider.activate();
				const continuing = yield* fleet.continue("one", "Continue after the steered turn").pipe(Effect.forkChild);
				yield* Effect.race(provider.waiting, Fiber.join(continuing).pipe(Effect.asVoid));
				const waiting = yield* fleet.get("one");
				expect(waiting.value.step).toBe("working");
				expect(waiting.value.attempts).toHaveLength(1);
				expect(waiting.value.attempts[0]).toMatchObject({
					operationId: "operation-3",
					sessionId: started.value.attempts[0]?.receipt?.sessionId,
					status: "submitting",
				});
				expect(waiting.value.decision).toBeUndefined();
				expect(waiting.value.attempts[0]?.receipt).toBeUndefined();
				yield* fleet.reconcile("one");
				expect(provider.submissions).toHaveLength(3);
				provider.complete();
				yield* Fiber.join(continuing);
				yield* Effect.gen(function* () {
					while ((yield* fleet.get("one")).value.attempts[0]?.receipt === undefined) {
						yield* Effect.yieldNow;
					}
				}).pipe(Effect.timeout("5 seconds"));
				const continued = yield* fleet.get("one");
				expect(continued.value.step).toBe("working");
				expect(continued.value.attempts).toHaveLength(1);
				expect(continued.value.attempts[0]?.receipt).toEqual({
					sessionId: started.value.attempts[0]?.receipt?.sessionId,
					turnId: "turn-operation-3",
				});
				expect(provider.submissions.at(-1)).toEqual(provider.submissions.at(-2));
				expect(fixture.operations.size).toBe(3);
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				merged = true;
				const delivered = yield* fleet.reconcile("one");
				expect(delivered.value.step).toBe("done");
				expect(delivered.value.review?.head).toBe(delivered.value.result?.head);
				expect(delivered.value.checks?.head).toBe(delivered.value.result?.head);
			}),
	);
});
